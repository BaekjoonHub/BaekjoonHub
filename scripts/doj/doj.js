// Set to true to enable console log
const debug = false;

/*
  DOJ 는 제출하면 내 제출 목록(/<언어>/submissions)으로 옮겨 가고, 채점 결과가 나오면 window 에 doj:submissions-updated 이벤트를 낸다.
  그 두 때에 내 제출 목록을 받아, 방금 맞은 풀이를 GitHub 에 올린다.
  - 사이트의 페이지 이동은 새로 고침 없이 일어나 콘텐츠 스크립트가 다시 실행되지 않는다. 그래서 주소가 바뀌는 것을 MutationObserver 로 알아챈다.
  - 사이트가 그 제출을 처음 볼 때 이미 채점이 끝나 있으면 이벤트를 내지 않는다. 그래서 목록으로 옮겨 간 때에도 본다.

  DOJ 서버에 요청할 때 지킬 것 (이용약관 8 은 과도한 자동 요청을 금지한다):
  - 스스로 주기적으로 받지 않는다. 위의 두 때와, 채점 중이라 다시 볼 때(RETRY_DELAYS)만 내 제출 목록을 받는다.
  - 올릴 풀이 하나에 문제 정보(공개 API /api/v1, IP당 분당 약 120회)와 제출 상세 페이지를 한 번씩만 받는다.
*/
let observer;
let lastPath = null;
let retryTimer = null;
let queue = Promise.resolve(); // 한 번에 하나씩 처리한다
const handled = new Set(); // 이미 올리려 한 제출 id. 실패한 제출은 페이지를 새로 고치면 다시 올린다

/* 채점 중인 제출이 남아 있을 때 다시 보기까지 기다리는 시간(ms) */
const RETRY_DELAYS = [3000, 6000, 12000];

startLoader();

function startLoader() {
  window.addEventListener('doj:submissions-updated', schedule);
  observer = new MutationObserver(onPageChange);
  observer.observe(document.body, { childList: true, subtree: true });
  onPageChange();
}

function stopLoader() {
  window.removeEventListener('doj:submissions-updated', schedule);
  observer.disconnect();
  clearTimeout(retryTimer);
}

function onPageChange() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  if (/^\/[^/]+\/submissions\/?$/.test(lastPath)) schedule();
}

function schedule() {
  /* 확장이 갱신되어 컨텍스트가 무효가 되면 storage 접근이 계속 reject 된다 */
  if (!chrome.runtime?.id) {
    stopLoader();
    return;
  }
  queue = queue.then(() => checkSubmissions(0));
}

/**
 * 내 제출 목록을 받아, 최근에 맞은 풀이 가운데 아직 올리지 않은 것을 올립니다. reject 되지 않는다.
 * @param {number} retry - 채점 중이라 다시 본 횟수
 */
async function checkSubmissions(retry) {
  try {
    clearTimeout(retryTimer);
    if (!(await checkEnable())) return;
    if (isNull(await getToken()) || isNull(await getHook())) {
      log('GitHub 저장소가 연결되어 있지 않아 올리지 않습니다');
      return;
    }
    const locale = /^\/([a-z]{2}(?:-[A-Z]{2})?)(?:\/|$)/.exec(location.pathname)?.[1] ?? 'ko';
    const response = await fetch(`/api/my-submissions?locale=${locale}&limit=8`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`내 제출 목록을 받지 못했습니다 (${response.status})`);
    const submissions = (await response.json()).submissions || [];
    const now = Date.now();
    for (const submission of pickUploads(submissions, now)) {
      if (handled.has(submission.id)) continue;
      handled.add(submission.id);
      await uploadSubmission(submission, locale);
    }
    const judging = submissions.some((submission) => DOJ_JUDGING.includes(submission.verdict) && isFresh(submission, now));
    if (judging && retry < RETRY_DELAYS.length) {
      retryTimer = setTimeout(() => {
        queue = queue.then(() => checkSubmissions(retry + 1));
      }, RETRY_DELAYS[retry]);
    }
  } catch (error) {
    console.error('[BaekjoonHub] DOJ 의 내 제출 목록을 확인하지 못했습니다.', error);
  }
}

/**
 * 맞은 제출 하나를 GitHub 에 올리고 토스트로 알립니다. reject 되지 않는다.
 * @param {object} submission - /api/my-submissions 의 submissions 항목
 * @param {string} locale - 화면 표시 언어 (주소의 첫 마디)
 */
async function uploadSubmission(submission, locale) {
  try {
    const problemResponse = await fetch(`/api/v1/problems/${submission.problemDisplayId}`);
    /* 공개 API 가 모르는 문제(비공개 문제, 대회 중인 문제)는 올리지 않는다 */
    if (problemResponse.status === 404) {
      log('공개되지 않은 문제의 제출이라 올리지 않습니다', submission.problemDisplayId);
      return;
    }
    if (!problemResponse.ok) throw new Error(`문제 정보를 받지 못했습니다 (${problemResponse.status})`);
    const { problem } = await problemResponse.json();

    const detailResponse = await fetch(`/${locale}/submissions/${submission.id}`);
    if (!detailResponse.ok) throw new Error(`제출 상세 페이지를 받지 못했습니다 (${detailResponse.status})`);
    const code = findDojCode(await detailResponse.text());
    /* 읽은 글의 길이가 목록에 적힌 코드 길이와 다르면 올리지 않는다 (다른 글을 코드로 잘못 읽은 것이다) */
    const { codeLength } = submission;
    const sameLength = isNull(codeLength) || code?.length === codeLength || new TextEncoder().encode(code ?? '').length === codeLength;
    if (!isNotEmpty(code) || !sameLength) throw new Error('제출한 코드를 읽지 못했습니다');

    const bojData = await makeData(submission, problem, code);
    log('bojData', bojData);
    await uploadUnlessSame(bojData, (branches, directory, committed) => {
      if (committed) new Toast(`DOJ ${bojData.problemId}번 풀이를 GitHub 에 올렸습니다.`, ToastType.Succes, 5000);
    });
  } catch (error) {
    console.error('[BaekjoonHub] DOJ 업로드 중 오류가 발생했습니다.', error);
    const reason = error?.name === 'TokenExpiredError' ? 'GitHub 토큰이 만료되었습니다. BaekjoonHub 설정에서 다시 로그인해 주세요.' : error?.message || `${error}`;
    Toast.raiseToast(`DOJ 풀이를 GitHub 에 올리지 못했습니다: ${reason}`);
  }
}
