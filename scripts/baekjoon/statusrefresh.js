/* BOJ 제출 현황 표의 멈춘 결과 칸을 채우는 스크립트. manifest 에서 "world": "MAIN" 으로 등록해 페이지 컨텍스트에서 돈다.
   확장 스크립트(격리된 세계)는 페이지의 display_solution·jQuery·pusher 에 닿지 못하기 때문이다.

   BOJ 의 status.js 는 채점이 끝나지 않은 제출마다 Pusher 채널 solution-<id> 를 구독하고, 구독이 성공하면 /status/ajax 를 한 번 부른 뒤에야
   update 이벤트를 display_solution 에 연결한다. 구독이 실패하거나, 그 요청이 실패하거나, 최종 결과 이벤트가 연결보다 먼저 오면 행이 멈춘다.
   이 스크립트는 스스로는 아무것도 지켜보지 않고, 로더(baekjoon.js)가 postMessage 로 부탁한 제출만 지켜본다.
   실시간 이벤트가 오는 동안에는 요청을 보내지 않고, 오지 않을 때만 /status/ajax 를 간격을 늘려 가며 부른다. */
(function () {
  'use strict';

  // Set to true to enable console log
  const debug = false;

  const ASK_TYPE = 'BaekjoonHub:watch-solution'; // baekjoon.js 의 askToWatchSolution 과 같은 값
  const FIRST_DELAY_MS = 6000; // 첫 요청까지 대기 (페이지가 열릴 때 BOJ 가 이미 한 번 확인하고, 이벤트도 기다려 본다)
  const FIRST_DELAY_PUSHER_DOWN_MS = 2000; // 실시간 연결이 이미 끊겼으면 기다릴 이유가 없다
  const MIN_DELAY_MS = 2000; // 상태가 바뀐 직후의 요청 간격
  const MAX_DELAY_ACTIVE_MS = 5000; // 채점 준비 중·채점 중·런타임 에러 이유 확인 중의 간격 상한 (곧 끝난다)
  const MAX_DELAY_WAITING_MS = 15000; // 기다리는 중·재채점 대기·n초 후 채점 시작의 간격 상한 (대기열이 길 수 있다)
  const BACKOFF = 1.5; // 상태가 그대로면 간격을 늘리는 배수
  const JITTER = 0.2; // 모든 대기 시간을 ±20% 흔든다 (여러 탭·사용자가 같은 순간에 요청하지 않게)
  const RESUME_JITTER_MS = 1000; // 탭이 다시 보일 때와 n초 후 채점 시작 뒤에 0~1초 흩어서 시작
  const ERROR_PAUSE_MS = 5000; // 요청이 실패하면 전체를 쉬는 시간 (연속 실패마다 두 배)
  const ERROR_PAUSE_MAX_MS = 60000;
  const REQUEST_TIMEOUT_MS = 20000; // 응답이 오지 않는 요청이 "요청 한 개만" 규칙을 영영 막지 않게
  const MAX_WATCH_MS = 10 * 60 * 1000; // 한 제출은 처음 지켜본 때부터 10분까지만
  const AUDIT_ACTIVE_MS = 8000; // 실시간 동작 중 이만큼 이벤트가 없으면 화면을 점검 (채점 중엔 진행률 이벤트가 자주 온다)
  const AUDIT_WAITING_MS = 30000; // 기다리는 중엔 원래 조용하다
  const FINAL_CHECK_MS = 2000; // 최종 결과 이벤트 뒤 화면을 확인하는 간격
  const FINAL_SETTLE_MS = 8000; // BOJ 가 늦게 받은 /status/ajax 응답이 이 시간 안에 옛 상태를 덮어써도 다시 그릴 수 있게 지켜보는 시간

  // 아직 끝나지 않은 결과 코드 (App.result_colors() 기준 색: wait, rejudge-wait, compile, judging, compile, judging)
  const PENDING = [0, 1, 2, 3, 14, 16];
  const WAITING = [0, 1, 14];
  const PENDING_COLORS = ['wait', 'rejudge-wait', 'compile', 'judging'];
  const DOWN_STATES = ['unavailable', 'failed', 'disconnected']; // Pusher 4.2 연결 상태 중 끊긴 것

  // 채점 현황 표가 있는 페이지(status.js 가 로드된 페이지)의 MAIN 세계에서만 동작한다. 격리된 세계로 실행되면 아무것도 하지 않는다.
  if (typeof window.display_solution !== 'function' || !Array.isArray(window.solution_ids) || !window.jQuery) return;

  function log(...args) {
    if (debug) console.log('[BaekjoonHub 제출 현황]', ...args);
  }

  const isPending = (result) => PENDING.includes(parseInt(result, 10));
  const isWaiting = (result) => WAITING.includes(parseInt(result, 10));
  const jitter = (ms) => ms * (1 - JITTER + Math.random() * 2 * JITTER);
  const stateKey = (ans) => [ans.result, ans.progress || '', ans.remain || ''].join('/');
  const colorOf = (result) => (Array.isArray(window.result_colors) ? window.result_colors[parseInt(result, 10)] : undefined);
  const screenColor = (id) => document.querySelector(`#solution-${id} td.result span.result-text`)?.getAttribute('data-color');
  // 화면의 결과 칸이 최종 결과를 보여 주는가 (BOJ 가 열 때 확인한 결과나 이벤트로 그려진 결과 포함)
  const finalOnScreen = (id) => {
    const color = screenColor(id);
    return !!color && !PENDING_COLORS.includes(color);
  };
  const pusherDown = () => !window.pusher?.connection || DOWN_STATES.includes(window.pusher.connection.state);
  const auditDue = (job) => Date.now() + jitter(isWaiting(job.result) ? AUDIT_WAITING_MS : AUDIT_ACTIVE_MS);

  // id -> { id, start, mode, result, delay, due, key, eventAt, finalEvent, finalAt, channel, onUpdate }
  // mode: 'polling' = 이벤트가 오지 않아 직접 확인, 'realtime' = 이벤트가 도착함(조용한 제출만 가끔 점검)
  const jobs = {};
  const gaveUp = new Set(); // 시간 초과나 오류로 포기한 제출 (로더가 계속 부탁해도 다시 시작하지 않는다)
  let timer = null;
  let inFlight = false;
  let errorDelay = 0;
  let pausedUntil = 0;
  let armed = false;

  function switchToPolling(job) {
    if (job.mode === 'polling' || job.finalEvent) return;
    job.mode = 'polling';
    job.delay = MIN_DELAY_MS;
    job.due = Date.now() + jitter(MIN_DELAY_MS);
  }

  // 요청은 쉬는 시간(pausedUntil)을 따르지만, 요청 없이 화면만 확인하는 최종 결과 점검은 따르지 않는다
  const dueAt = (job) => (job.finalEvent ? job.due : Math.max(job.due, pausedUntil));

  // 요청은 한 번에 하나만, 탭이 안 보이면 보내지 않는다. 화면만 확인하는 일은 막지 않는다.
  function nextJob() {
    let best = null;
    for (const id of Object.keys(jobs)) {
      if ((inFlight || document.hidden) && !jobs[id].finalEvent) continue;
      if (best === null || dueAt(jobs[id]) < dueAt(jobs[best])) best = id;
    }
    return best;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    const id = nextJob();
    if (id !== null) timer = setTimeout(run, Math.max(0, dueAt(jobs[id]) - Date.now()));
  }

  function end(job, giveUp) {
    delete jobs[job.id];
    if (giveUp) gaveUp.add(job.id);
    job.channel?.unbind('update', job.onUpdate);
    log('끝', job.id, giveUp ? '(포기)' : '');
    schedule();
  }

  // BOJ 가 구독한 채널에 우리 update 핸들러도 붙인다. 이벤트가 왔다는 사실이 실시간 동작의 증거다.
  function bindChannel(job) {
    if (job.channel) return;
    const channel = window.pusher?.channel?.(`solution-${job.id}`);
    if (!channel) return;
    job.channel = channel;
    channel.bind('update', job.onUpdate);
  }

  function onUpdate(job, data) {
    if (jobs[job.id] !== job || job.finalEvent || !data || data.result === undefined) return;
    job.eventAt = Date.now();
    job.mode = 'realtime';
    job.result = parseInt(data.result, 10);
    if (isPending(data.result)) {
      job.key = stateKey(data);
      job.due = auditDue(job);
    } else {
      /* 최종 결과 이벤트만으로 끝내지 않는다. BOJ 가 아직 update 핸들러를 연결하지 않았으면 화면은 그대로이고,
         BOJ 가 늦게 받은 /status/ajax 응답이 옛 상태를 이 결과 위에 다시 그릴 수도 있다. 화면을 확인하며 지켜본다. */
      job.finalEvent = data;
      job.finalAt = job.eventAt;
      job.due = job.eventAt + FINAL_CHECK_MS;
    }
    schedule();
  }

  function settle(job) {
    if (!finalOnScreen(job.id)) window.display_solution(job.id, { ...job.finalEvent }); // 요청 없이 이벤트가 전한 결과를 그린다
    else if (Date.now() - job.finalAt >= FINAL_SETTLE_MS) return end(job, false);
    job.due = Date.now() + FINAL_CHECK_MS;
    schedule();
  }

  function onAnswer(job, ans, sentAt, colorBefore) {
    if (jobs[job.id] !== job) return;
    if (!ans || ans.error) return end(job, true);
    if (job.eventAt > sentAt) return; // 기다리는 사이 이벤트가 왔다. 응답은 그 이벤트보다 옛 상태일 수 있어 그리지 않는다.

    // 화면이 서버보다 뒤처져 있었다 = 실시간 이벤트가 그 변화를 전하지 못했다 (응답을 기다리는 사이 화면이 바뀐 경우는 제외)
    const serverColor = colorOf(ans.result);
    const screenWasStale = !!colorBefore && !!serverColor && colorBefore !== serverColor && screenColor(job.id) === colorBefore;
    window.display_solution(job.id, ans); // BOJ 자체 표시 함수로 그대로 그린다
    if (!isPending(ans.result)) return end(job, false);

    job.result = parseInt(ans.result, 10);
    if (screenWasStale && job.mode === 'realtime' && !pusherDown()) switchToPolling(job);
    const key = stateKey(ans);
    if (job.mode === 'realtime') {
      job.key = key;
      job.due = auditDue(job);
      return;
    }
    // 상태가 움직이는 중이면 짧은 간격을 유지하고, 그대로면 점점 천천히
    job.delay = key !== job.key ? MIN_DELAY_MS : Math.min(job.delay * BACKOFF, isWaiting(job.result) ? MAX_DELAY_WAITING_MS : MAX_DELAY_ACTIVE_MS);
    job.key = key;
    let wait = jitter(job.delay);
    // "n초 후 채점 시작"이면 그 시각보다 일찍 묻지 않고, 그 뒤 0~1초 사이로 흩어서 확인
    if (job.result === 14 && ans.remain) wait = Math.max(wait, parseInt(ans.remain, 10) * 1000 + Math.random() * RESUME_JITTER_MS);
    job.due = Date.now() + wait;
  }

  function request(job) {
    const sentAt = Date.now();
    const colorBefore = screenColor(job.id);
    inFlight = true;
    log('요청', job.id);
    // BOJ 의 status.js 가 보내는 것과 같은 요청
    window.jQuery.ajax({ type: 'POST', url: '/status/ajax', data: { solution_id: job.id }, timeout: REQUEST_TIMEOUT_MS })
      .done((ans) => {
        inFlight = false;
        errorDelay = 0;
        try {
          onAnswer(job, ans, sentAt, colorBefore);
        } finally {
          schedule();
        }
      })
      .fail(() => {
        inFlight = false;
        errorDelay = Math.min(errorDelay ? errorDelay * 2 : ERROR_PAUSE_MS, ERROR_PAUSE_MAX_MS);
        // 절반은 반드시 쉬고 나머지 절반은 무작위 (서버가 힘들 때 다 같이 재시도하지 않게)
        pausedUntil = Date.now() + errorDelay / 2 + (Math.random() * errorDelay) / 2;
        schedule();
      });
  }

  function run() {
    timer = null;
    const id = nextJob();
    if (id === null) return;
    const job = jobs[id];
    if (Date.now() < dueAt(job)) return schedule();
    if (job.finalEvent) return settle(job);
    if (Date.now() - job.start > MAX_WATCH_MS) return end(job, true);
    bindChannel(job);
    if (finalOnScreen(id)) return end(job, false); // 이미 결과가 있으면 묻지 않는다 (BOJ 가 열 때 확인했거나 이벤트로 그려진 경우)
    request(job);
  }

  // 요청을 받은 뒤에야 건다. 부탁이 없는 페이지에서는 아무 리스너도 남기지 않는다.
  function arm() {
    if (armed) return;
    armed = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      pausedUntil = Math.max(pausedUntil, Date.now() + Math.random() * RESUME_JITTER_MS); // 탭으로 돌아오면 0~1초 흩어서 시작
      schedule();
    });
    // 실시간 연결이 끊기면(BOJ 가 오래 열린 탭의 연결을 끊는 경우 포함) 다시 직접 확인
    window.pusher?.connection?.bind?.('state_change', (state) => {
      if (!DOWN_STATES.includes(state?.current)) return;
      Object.values(jobs).forEach(switchToPolling);
      schedule();
    });
  }

  function watch(id) {
    arm();
    const now = Date.now();
    const color = screenColor(id);
    const entry = window.solution_ids.find((solution) => String(solution[0]) === id);
    const first = pusherDown() ? FIRST_DELAY_PUSHER_DOWN_MS : FIRST_DELAY_MS;
    const job = {
      id,
      start: now,
      mode: 'polling',
      // 14(n초 후 채점 시작)·16 은 색이 2·3 과 같아 화면으로는 가를 수 없어, 화면과 같은 색일 때만 페이지의 solution_ids 코드를 쓴다
      result: entry && colorOf(entry[1]) === color ? parseInt(entry[1], 10) : Math.max(PENDING_COLORS.indexOf(color), 0),
      delay: MIN_DELAY_MS,
      due: now + Math.max(first, jitter(first)), // "6초 이후"이므로 흔들어도 더 일찍은 보내지 않는다
      key: null,
      eventAt: 0,
      finalEvent: null,
      finalAt: 0,
      channel: null,
    };
    job.onUpdate = (data) => onUpdate(job, data);
    jobs[id] = job;
    bindChannel(job);
    log('지켜보기 시작', id);
    schedule();
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (!data || data.type !== ASK_TYPE || typeof data.id !== 'string' || !/^\d+$/.test(data.id)) return;
    if (jobs[data.id] || gaveUp.has(data.id) || !document.getElementById(`solution-${data.id}`)) return;
    watch(data.id);
  });
})();
