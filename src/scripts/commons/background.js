import urls from "@/constants/url.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import log from "@/commons/logger.js";

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
  log.info("background.js: handleMessage called with request:", request);
  if (request && request.closeWebPage === true && request.isSuccess === true) {
    /* Set username */
    chrome.storage.local.set({ [STORAGE_KEYS.USERNAME]: request.username }, () => {
      log.info("background.js: Username saved to local storage.");
      /* Set token */
      chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: request.token }, () => {
        log.info("background.js: Token saved to local storage.");
        /* Close pipe */
        chrome.storage.local.set({ [STORAGE_KEYS.PIPE]: false }, () => {
          log.info("Closed pipe.");

          /* Go to onboarding for UX */
          const urlOnboarding = `chrome-extension://${chrome.runtime.id}/settings.html`;
          chrome.tabs.create({ url: urlOnboarding, selected: true }); // creates new tab
        });
      });
    });
  } else if (request && request.closeWebPage === true && request.isSuccess === false) {
    log.error("background.js: Something went wrong while trying to authenticate your profile!");
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
