'use strict';

// scripts/baekjoon/statusrefresh.js 는 BOJ 페이지 컨텍스트에서 돌며(로더가 <script> 요소로 넣는다), 로더가 부탁한 제출만 지켜본다.
// 실제 파일을 vm 에 로드하고 가짜 시계·가짜 페이지(display_solution, jQuery.ajax, Pusher)로 규칙을 하나씩 확인한다.
// 난수는 0.5 로 고정해 ±20% 흔들림이 1배가 되게 한다. 시각은 ask 를 보낸 순간을 0 으로 읽는다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'scripts/baekjoon/statusrefresh.js'), 'utf8');
const ORIGIN = 'https://acmicpc.net';
const ID = '100000001';
// BOJ 의 App.result_colors() 값 (인덱스 = 결과 코드)
const COLORS = ['wait', 'rejudge-wait', 'compile', 'judging', 'ac', 'pe', 'wa', 'tle', 'mle', 'ole', 'rte', 'ce', 'del', 'del', 'compile', 'pac', 'judging'];
const tick = () => new Promise((resolve) => setImmediate(resolve));

/** 가짜 페이지. shortcut: 제출 행 하나(#solution-ID)만 안다, 여러 행이 필요해지면 행 맵으로 바꾼다. */
function load({ globals = true, hidden = false, pusherState = 'connected', color = 'compile', entry = [Number(ID), 2] } = {}) {
  let now = 1000000;
  let seq = 0;
  const timers = new Map();
  const log = { requests: [] };
  const listeners = { message: [], visibilitychange: [], state_change: [], update: [] };
  const span = { color, getAttribute: (name) => (name === 'data-color' ? span.color : null) };
  const server = { reply: () => ({ result: 2 }), delay: 0 };
  const channel = {
    bind: (event, fn) => { if (event === 'update') listeners.update.push(fn); },
    unbind: (event, fn) => { listeners.update = listeners.update.filter((f) => f !== fn); },
  };
  const document = {
    hidden,
    getElementById: (id) => (id === `solution-${ID}` ? {} : null),
    querySelector: (selector) => (selector === `#solution-${ID} td.result span.result-text` ? span : null),
    addEventListener: (type, fn) => listeners[type].push(fn),
  };
  const sandbox = {
    console, document, location: { origin: ORIGIN },
    Date: { now: () => now },
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    setTimeout: (fn, ms) => { timers.set(++seq, { at: now + Math.max(0, ms), fn }); return seq; },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (type, fn) => listeners[type].push(fn),
  };
  sandbox.window = sandbox;
  if (globals) {
    Object.assign(sandbox, {
      result_colors: COLORS,
      solution_ids: [entry],
      // 실제 display_solution 처럼 결과 코드의 색을 결과 칸에 그린다
      display_solution: (id, ans) => { span.color = COLORS[ans.result]; },
      pusher: { connection: { state: pusherState, bind: (event, fn) => listeners.state_change.push(fn) }, channel: (name) => (name === `solution-${ID}` ? channel : undefined) },
      jQuery: {
        ajax: (options) => {
          log.requests.push({ at: now, data: JSON.parse(JSON.stringify(options.data)), type: options.type, url: options.url });
          const handlers = {};
          const xhr = { done: (fn) => { handlers.done = fn; return xhr; }, fail: (fn) => { handlers.fail = fn; return xhr; } };
          sandbox.setTimeout(() => {
            let answer;
            try { answer = server.reply(); } catch { return handlers.fail(); }
            handlers.done(answer);
          }, server.delay);
          return xhr;
        },
      },
    });
  }
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'statusrefresh.js' });
  const pageWindow = vm.runInContext('window', sandbox); // 컨텍스트 안에서 본 window 는 sandbox 객체와 다른 전역 객체다

  const page = {
    log, server, timers, listeners, span, document, sandbox,
    start: now,
    times: () => log.requests.map((request) => request.at - page.start),
    /** 가짜 시계를 ms 만큼 돌린다 */
    advance: async (ms) => {
      const until = now + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        now = Math.max(now, next[1].at);
        next[1].fn();
        await tick();
      }
      now = until;
    },
    /** 로더의 부탁. 기본은 같은 창·같은 출처에서 온 올바른 부탁이다. */
    ask: (data = { type: 'BaekjoonHub:watch-solution', id: ID }, event = {}) => listeners.message.forEach((fn) => fn({ source: pageWindow, origin: ORIGIN, data, ...event })),
    /** BOJ 의 status.js 가 하듯 update 이벤트를 display_solution 에 연결한다 */
    bindPageHandler: () => channel.bind('update', (data) => sandbox.display_solution(ID, data)),
    emit: (data) => listeners.update.slice().forEach((fn) => fn(data)),
    setHidden: (value) => { document.hidden = value; if (!value) listeners.visibilitychange.forEach((fn) => fn()); },
    setPusherState: (state) => { sandbox.pusher.connection.state = state; listeners.state_change.forEach((fn) => fn({ previous: 'connected', current: state })); },
  };
  return page;
}

test('이벤트가 계속 오면 요청을 보내지 않고, 조용해지면 점검만 하며, 결과를 받으면 요청 없이 끝난다', async () => {
  const page = load();
  page.bindPageHandler();
  page.ask();
  for (let percent = 0; percent < 60; percent += 5) {
    await page.advance(3000);
    page.emit({ result: 3, progress: String(percent) });
  }
  assert.deepEqual(page.times(), [], '이벤트가 오는 동안에는 요청이 없다');
  // 이벤트가 끊기면 8초 뒤 화면을 보고(채점 중 그대로), 그때 한 번 묻는다. 정기 확인으로 돌아가지 않으므로 다음 점검도 8초 뒤다.
  page.server.reply = () => ({ result: 3, progress: '55' });
  await page.advance(7900);
  assert.deepEqual(page.times(), []);
  await page.advance(200);
  assert.equal(page.log.requests.length, 1);
  await page.advance(7800);
  assert.equal(page.log.requests.length, 1);
  await page.advance(200);
  assert.equal(page.log.requests.length, 2);

  page.emit({ result: 4 }); // 최종 결과 이벤트: BOJ 의 핸들러가 그린다
  await page.advance(20000);
  assert.equal(page.span.color, 'ac');
  assert.equal(page.log.requests.length, 2, '끝나는 데 요청이 필요 없다');
  assert.equal(page.timers.size, 0, '지켜보기를 끝냈다');
});

test('이벤트가 없으면 6초(연결이 끊겼으면 2초)에 첫 요청을 보내고, 간격을 늘리다 최종 결과를 그리면 끝난다', async () => {
  const page = load();
  page.ask();
  await page.advance(5900);
  assert.deepEqual(page.times(), []);
  await page.advance(100);
  assert.deepEqual(page.log.requests[0], { at: page.start + 6000, data: { solution_id: ID }, type: 'POST', url: '/status/ajax' });
  await page.advance(60000);
  // 상태가 그대로면 직전 간격 x1.5, 채점 중은 5초가 상한
  assert.deepEqual(page.times(), [6000, 8000, 11000, 15500, 20500, 25500, 30500, 35500, 40500, 45500, 50500, 55500, 60500, 65500]);
  page.server.reply = () => ({ result: 4 });
  await page.advance(5000);
  assert.equal(page.span.color, 'ac');
  assert.equal(page.timers.size, 0);
  const requests = page.log.requests.length;
  await page.advance(60000);
  assert.equal(page.log.requests.length, requests, '최종 결과를 그린 뒤에는 묻지 않는다');

  // 기다리는 중은 15초가 상한
  const waiting = load({ color: 'wait', entry: [Number(ID), 0] });
  waiting.server.reply = () => ({ result: 0 });
  waiting.ask();
  await waiting.advance(80000);
  assert.deepEqual(waiting.times(), [6000, 8000, 11000, 15500, 22250, 32375, 47375, 62375, 77375]);

  // n초 후 채점 시작: remain 초가 지나기 전에는 묻지 않는다
  const remain = load({ color: 'compile', entry: [Number(ID), 14] });
  remain.server.reply = () => ({ result: 14, remain: 20 });
  remain.ask();
  await remain.advance(40000);
  assert.deepEqual(remain.times(), [6000, 26500]);

  const down = load({ pusherState: 'unavailable' });
  down.ask();
  await down.advance(1900);
  assert.deepEqual(down.times(), []);
  await down.advance(100);
  assert.deepEqual(down.times(), [2000]);

  // 처음엔 이벤트를 기다리다가 연결이 끊기면 짧은 간격의 정기 확인으로 돌아간다
  const dropped = load();
  dropped.ask();
  dropped.emit({ result: 3, progress: '10' });
  await dropped.advance(3000);
  assert.deepEqual(dropped.times(), []);
  dropped.setPusherState('disconnected');
  await dropped.advance(2000);
  assert.deepEqual(dropped.times(), [5000]);
});

test('최종 결과 이벤트가 BOJ 의 핸들러 연결보다 먼저 와도, 뒤늦은 옛 응답이 덮어써도 10초 안에 결과가 화면에 오고 요청은 없다', async () => {
  const page = load(); // BOJ 의 update 핸들러는 아직 연결되지 않았다
  page.ask();
  await page.advance(3000);
  page.emit({ result: 4 });
  assert.equal(page.span.color, 'compile', '이벤트만으로는 화면이 바뀌지 않았다');
  await page.advance(2000);
  assert.equal(page.span.color, 'ac', '요청 없이 이벤트가 전한 결과를 그린다');
  page.span.color = 'judging'; // BOJ 가 늦게 받은 /status/ajax 응답이 옛 상태를 덮어쓴다
  await page.advance(2000);
  assert.equal(page.span.color, 'ac');
  await page.advance(6000); // 이벤트로부터 10초
  assert.equal(page.span.color, 'ac');
  assert.deepEqual(page.times(), []);
  assert.equal(page.timers.size, 0, '화면이 맞는 것을 확인한 뒤에 끝났다');
});

test('탭이 보이지 않으면 요청을 보내지 않고, 다시 보이면 0~1초 뒤에 시작하며, 요청은 한 번에 하나만 보낸다', async () => {
  const page = load({ hidden: true });
  page.ask();
  await page.advance(60000);
  assert.deepEqual(page.times(), []);
  page.setHidden(false);
  await page.advance(400);
  assert.deepEqual(page.times(), []);
  await page.advance(100);
  assert.deepEqual(page.times(), [60500]);

  const slow = load();
  slow.server.delay = 30000; // 응답이 오지 않는 동안에는 다음 요청을 보내지 않는다
  slow.ask();
  await slow.advance(25000);
  assert.equal(slow.log.requests.length, 1);
});

test('요청이 실패하면 쉬는 시간을 두 배씩(최대 60초) 늘리고 성공하면 처음으로 돌아가며, 10분이 지나면 포기하고 다시 부탁해도 시작하지 않는다', async () => {
  const page = load();
  page.server.reply = () => { throw new Error('실패'); };
  page.ask();
  await page.advance(100000);
  // 쉬는 시간 = 절반 고정 + 절반 무작위 (난수 0.5 → 5, 10, 20, 40, 60초의 0.75배)
  assert.deepEqual(page.times(), [6000, 9750, 17250, 32250, 62250, 107250].filter((time) => time <= 100000));
  let n = page.log.requests.length;
  page.server.reply = () => ({ result: 3 });
  await page.advance(45000);
  const [first, second] = page.times().slice(n);
  assert.equal(second - first, 2000, '성공하면 다시 정상 간격이다');
  n = page.log.requests.length;
  page.server.reply = () => { throw new Error('실패'); };
  await page.advance(20000);
  const [failed, retried] = page.times().slice(n);
  assert.equal(retried - failed, 3750, '쉬는 시간도 5초부터 다시 시작한다');

  page.server.reply = () => ({ result: 3 });
  await page.advance(600000);
  assert.ok(page.times().every((time) => time <= 600000), '10분 뒤에는 묻지 않는다');
  assert.equal(page.timers.size, 0);
  const requests = page.log.requests.length;
  page.ask();
  await page.advance(60000);
  assert.equal(page.log.requests.length, requests);
  assert.equal(page.timers.size, 0, '포기한 제출은 다시 시작하지 않는다');
});

test('다른 출처·다른 창·잘못된 아이디·화면에 없는 제출의 부탁은 무시하고, 페이지 함수에 닿지 못하면 아무것도 하지 않는다', async () => {
  const page = load();
  const good = { type: 'BaekjoonHub:watch-solution', id: ID };
  page.ask(good, { origin: 'https://evil.example' });
  page.ask(good, { source: {} });
  for (const id of ['12a', '', '1 2', `${ID}\n`, '999', 100000001, undefined]) page.ask({ type: good.type, id });
  page.ask({ type: 'other', id: ID });
  page.ask(null);
  await page.advance(60000);
  assert.equal(page.timers.size, 0);
  assert.deepEqual(page.times(), []);
  assert.equal(page.listeners.visibilitychange.length, 0, '부탁 전에는 어떤 리스너도 걸지 않는다');
  page.ask();
  await page.advance(6000);
  assert.deepEqual(page.times(), [66000], '올바른 부탁은 받는다(60초 뒤 부탁했으므로 66초)');

  const isolated = load({ globals: false }); // 격리된 세계: 페이지의 display_solution 등이 보이지 않는다
  assert.equal(isolated.listeners.message.length, 0);
  assert.equal(isolated.listeners.visibilitychange.length, 0);
});

test('JSON 이 아닌 응답은 display_solution 에 넘기지 않고 실패한 요청처럼 쉰다', async () => {
  const page = load();
  const received = [];
  // BOJ 의 display_solution 처럼 객체가 아니면 던진다
  page.sandbox.display_solution = (id, ans) => { received.push(ans); if (typeof ans !== 'object') throw new TypeError("'memory' in ans"); };
  page.server.reply = () => '<html>login</html>';
  page.ask();
  await page.advance(100000);
  assert.deepEqual(page.times(), [6000, 9750, 17250, 32250, 62250], '실패한 요청과 같은 쉬는 시간');
  assert.deepEqual(received, [], '문자열은 그리지 않는다');
});

test('최종 결과 이벤트 뒤 그리다 던지면 그 제출은 포기로 끝난다', async () => {
  const page = load();
  page.sandbox.display_solution = () => { throw new Error('그리기 실패'); };
  page.ask();
  page.emit({ result: 4 });
  await page.advance(10000);
  assert.equal(page.timers.size, 0);
  page.ask();
  assert.equal(page.timers.size, 0, '포기한 제출은 다시 시작하지 않는다');
});
