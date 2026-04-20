/**
 * solvedac 문제 데이터를 파싱해오는 함수. 429(Too Many Requests)를 만나면
 * 지수 backoff 후 재시도한다. 모든 재시도가 실패하면 null 반환.
 * @param {int} problemId
 */
async function SolvedApiCall(problemId) {
  const url = `https://solved.ac/api/v3/problem/show?problemId=${problemId}`;
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
  console.warn('SolvedApiCall failed after retries', problemId, lastErr);
  return null;
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
