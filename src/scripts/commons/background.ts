/**
 * Background service worker for BaekjoonHub Chrome Extension
 * Handles messaging, Solved.ac API calls, authentication flow, and migration
 */
import urls from "@/constants/url";
import { STORAGE_KEYS } from "@/constants/registry";
import log from "@/commons/logger";
import { runMigrationSafely } from "./migration";

// Message request interface
interface MessageRequest {
  closeWebPage?: boolean;
  isSuccess?: boolean;
  username?: string;
  token?: string;
  KEY?: string;
  sender?: string;
  task?: string;
  problemId?: number;
}

// Solved.ac problem response interface
interface SolvedAcProblem {
  problemId: number;
  titleKo: string;
  level: number;
  tags: Array<{
    key: string;
    displayNames: Array<{
      language: string;
      name: string;
    }>;
  }>;
  [key: string]: unknown;
}

/**
 * Fetch problem data from Solved.ac API
 * @param problemId - Baekjoon problem ID
 * @returns Problem data from Solved.ac
 */
export async function SolvedApiCall(problemId: number): Promise<SolvedAcProblem> {
  const response = await fetch(`${urls.SOLVED_AC_API_PROBLEM_SHOW_URL}${problemId}`, {
    method: "GET",
  });
  return response.json();
}

/**
 * Handle messages from content scripts and popup
 * @param request - Message request object
 * @param sender - Message sender info
 * @param sendResponse - Response callback function
 * @returns true to indicate async response
 */
export function handleMessage(
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  log.info("background.ts: handleMessage called with request:", request);

  if (request && request.closeWebPage === true && request.isSuccess === true) {
    // Authentication successful - save credentials
    chrome.storage.local.set({ [STORAGE_KEYS.USERNAME]: request.username }, () => {
      log.info("background.ts: Username saved to local storage.");

      chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: request.token }, () => {
        log.info("background.ts: Token saved to local storage.");

        // Close pipe
        chrome.storage.local.set({ [STORAGE_KEYS.PIPE]: false }, () => {
          log.info("Closed pipe.");

          // Open settings page for onboarding
          const urlOnboarding = `chrome-extension://${chrome.runtime.id}/settings.html`;
          chrome.tabs.create({ url: urlOnboarding, selected: true });
        });
      });
    });
  } else if (request && request.closeWebPage === true && request.isSuccess === false) {
    // Authentication failed
    log.error("background.ts: Something went wrong while trying to authenticate your profile!");
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id) {
        chrome.tabs.remove(tab.id);
      }
    });
  } else if (request && request.sender === "baekjoon" && request.task === "SolvedApiCall") {
    // Solved.ac API call request
    SolvedApiCall(request.problemId!).then((res) => sendResponse(res));
  }

  return true; // Indicates async response
}

// Register message listener
chrome.runtime.onMessage.addListener(handleMessage);

/**
 * Handle extension install/update events
 * Runs migration when extension is installed or updated
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  log.info("background.ts: onInstalled event fired with reason:", details.reason);

  if (details.reason === "install" || details.reason === "update") {
    log.info("background.ts: Running migration check...");

    const result = await runMigrationSafely();

    if (result.success) {
      if (result.migratedKeys.length > 0) {
        log.info("background.ts: Migration completed successfully. Migrated keys:", result.migratedKeys);
      } else {
        log.info("background.ts: No migration needed or already completed.");
      }
    } else {
      log.error("background.ts: Migration failed:", result.errors);
    }
  }
});
