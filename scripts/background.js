const SOLVED_API = 'https://solved.ac/api/v4';

/**
 * solved.ac API를 GET으로 부르는 함수. 429(Too Many Requests)를 만나면
 * 지수 backoff 후 재시도한다. 모든 재시도가 실패하면 null 반환.
 * @param {string} path - SOLVED_API 뒤에 붙는 경로 (예: '/problems/1000')
 */
async function solvedGet(path) {
  const url = SOLVED_API + path;
  const maxRetries = 4;
  let lastErr = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status === 429) {
        // Respect Retry-After 또는 지수 backoff (1s, 2s, 4s, 8s)
        const retryAfter = Number(res.headers.get('Retry-After'));
        const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0)
          ? retryAfter * 1000
          : 1000 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      if (!res.ok) {
        throw new Error(`solved.ac ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  console.warn('solved.ac request failed after retries', path, lastErr);
  return null;
}

/**
 * v4 문제 응답을 content script와 저장된 캐시(stats.solvedac)가 쓰는 v3 모양
 * (titleKo, level, tags[].displayNames)으로 바꾼다.
 * @param {Object} problem - GET /problems/{problemId} 응답
 * @param {Object} tagNames - 태그 key → 한국어 이름. v4 문제 응답의 태그에는 이름이 없다.
 */
function toV3Problem(problem, tagNames) {
  const titles = problem.titles || [];
  const title = titles.find((t) => t.language === 'ko') || titles.find((t) => t.isOriginal) || titles[0];
  return {
    problemId: problem.problemId,
    titleKo: title?.title,
    level: problem.level,
    tags: (problem.tags || []).map((tag) => ({
      key: tag.key,
      displayNames: [{ language: 'ko', name: tagNames[tag.key] || tag.key }],
    })),
  };
}

let solvedTagNames = null; // 태그 key → 한국어 이름. 서비스 워커가 살아 있는 동안만 유지한다.

/**
 * solvedac 문제 데이터를 파싱해오는 함수. 실패하면 null 반환.
 * @param {int} problemId
 */
async function SolvedApiCall(problemId) {
  const [problem, tagList] = await Promise.all([
    solvedGet(`/problems/${encodeURIComponent(problemId)}`),
    solvedTagNames ? null : solvedGet('/tags'),
  ]);
  if (Array.isArray(tagList?.tags)) {
    solvedTagNames = Object.fromEntries(tagList.tags.map((tag) => [tag.key, tag.names?.ko]));
  }
  return problem && toV3Problem(problem, solvedTagNames || {});
}

function handleMessage(request, sender, sendResponse) {
  if (request && request.closeWebPage === true && request.isSuccess === true) {
    /* Set username */
    chrome.storage.local.set(
      { BaekjoonHub_username: request.username } /* , () => {
      window.localStorage.BaekjoonHub_username = request.username;
    } */,
    );

    /* Set token */
    chrome.storage.local.set(
      { BaekjoonHub_token: request.token } /* , () => {
      window.localStorage[request.KEY] = request.token;
    } */,
    );

    /* Close pipe */
    chrome.storage.local.set({ pipe_BaekjoonHub: false }, () => {
      console.log('Closed pipe.');
    });

    // chrome.tabs.getSelected(null, function (tab) {
    //   chrome.tabs.remove(tab.id);
    // });

    /* Go to onboarding for UX */
    const urlOnboarding = `chrome-extension://${chrome.runtime.id}/welcome.html`;
    chrome.tabs.create({ url: urlOnboarding, selected: true }); // creates new tab
  } else if (request && request.closeWebPage === true && request.isSuccess === false) {
    alert('Something went wrong while trying to authenticate your profile!');
    chrome.tabs.getSelected(null, function (tab) {
      chrome.tabs.remove(tab.id);
    });
  } else if (request && request.sender == "baekjoon" && request.task == "SolvedApiCall") {
    SolvedApiCall(request.problemId).then((res) => sendResponse(res));
    //sendResponse(SolvedApiCall(request.problemId))
  }
  return true;
}

chrome.runtime.onMessage.addListener(handleMessage);
