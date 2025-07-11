import urls from "@/constants/url.js";

/**
 * solvedac 문제 데이터를 파싱해오는 함수.
 * @param {int} problemId
 */
export async function SolvedApiCall(problemId) {
  return fetch(`${urls.SOLVED_AC_API_PROBLEM_SHOW_URL}${problemId}`, {
    method: "GET",
  }).then((query) => query.json());
}

export function handleMessage(request, sender, sendResponse) {
  if (request && request.closeWebPage === true && request.isSuccess === true) {
    /* Set username */
    chrome.storage.local.set({ BaekjoonHub_username: request.username }, () => {
      /* Set token */
      chrome.storage.local.set({ BaekjoonHub_token: request.token }, () => {
        /* Close pipe */
        chrome.storage.local.set({ pipeBaekjoonHub: false }, () => {
          console.log("Closed pipe.");

          /* Go to onboarding for UX */
          const urlOnboarding = `chrome-extension://${chrome.runtime.id}/settings.html`;
          chrome.tabs.create({ url: urlOnboarding, selected: true }); // creates new tab
        });
      });
    });
  } else if (request && request.closeWebPage === true && request.isSuccess === false) {
    console.error("Something went wrong while trying to authenticate your profile!");
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.remove(tab.id);
    });
  } else if (request && request.sender === "baekjoon" && request.task === "SolvedApiCall") {
    SolvedApiCall(request.problemId).then((res) => sendResponse(res));
    // sendResponse(SolvedApiCall(request.problemId))
  }
  return true;
}

chrome.runtime.onMessage.addListener(handleMessage);
