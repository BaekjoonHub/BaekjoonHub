/**
 * BaekjoonHub Popup Entry Point
 * Handles authentication flow and popup UI state management
 */
import beginOAuth2 from "@/commons/oauth2";
import log from "@/commons/logger";
import { STORAGE_KEYS } from "@/constants/registry";
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage";

// State
let isAuthActionAllowed = false;

// DOM Elements interface
interface PopupElements {
  authMode: HTMLElement | null;
  hookMode: HTMLElement | null;
  commitMode: HTMLElement | null;
  repoUrl: HTMLElement | null;
  authenticate: HTMLElement | null;
  settingsUrl: HTMLElement | null;
  hookUrl: HTMLElement | null;
  enablePopup: HTMLInputElement | null;
}

/**
 * Get popup DOM elements
 */
function getElements(): PopupElements {
  return {
    authMode: document.querySelector("#auth_mode"),
    hookMode: document.querySelector("#hook_mode"),
    commitMode: document.querySelector("#commit_mode"),
    repoUrl: document.querySelector("#repo_url"),
    authenticate: document.querySelector("#authenticate"),
    settingsUrl: document.querySelector("#settings_URL"),
    hookUrl: document.querySelector("#hook_URL"),
    enablePopup: document.querySelector("#enable_popup"),
  };
}

/**
 * Show element by removing hidden attribute and setting display block
 */
function showElement(element: HTMLElement | null): void {
  if (element) {
    element.style.display = "block";
    element.removeAttribute("hidden");
  }
}

/**
 * Hide element by setting display none
 */
function hideElement(element: HTMLElement | null): void {
  if (element) {
    element.style.display = "none";
  }
}

/**
 * Handle GitHub authentication flow
 */
async function handleAuthentication(): Promise<void> {
  log.info("handleAuthentication: Starting GitHub authentication flow.");
  const token = await getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);
  log.info(`handleAuthentication: Token status - ${token ? "exists" : "null"}`);

  const elements = getElements();

  if (token === null || token === undefined) {
    log.info("handleAuthentication: Token is null or undefined, showing authorization mode.");
    isAuthActionAllowed = true;
    showElement(elements.authMode);
    hideElement(elements.hookMode);
    hideElement(elements.commitMode);
  } else {
    log.info("handleAuthentication: Token exists, attempting to verify with GitHub API.");
    const AUTHENTICATION_URL = "https://api.github.com/user";

    try {
      const response = await fetch(AUTHENTICATION_URL, {
        method: "GET",
        headers: {
          Authorization: `token ${token}`,
        },
      });

      log.info(`handleAuthentication: GitHub API response status: ${response.status}`);

      if (response.ok) {
        log.info("handleAuthentication: Token verified successfully.");
        const data = await getObjectFromLocalStorage<Record<string, unknown>>([STORAGE_KEYS.MODE_TYPE, STORAGE_KEYS.HOOK]);
        const modeType = data?.[STORAGE_KEYS.MODE_TYPE] as string | undefined;
        const baekjoonHubHook = data?.[STORAGE_KEYS.HOOK] as string | undefined;
        log.info(`handleAuthentication: Retrieved modeType=${modeType}, baekjoonHubHook=${baekjoonHubHook}`);

        hideElement(elements.authMode);

        if (modeType === "commit") {
          log.info("handleAuthentication: Mode is 'commit', showing commit mode UI.");
          hideElement(elements.hookMode);
          showElement(elements.commitMode);

          // Enable switch logic for popup
          if (elements.enablePopup) {
            const enableStatus = await getObjectFromLocalStorage(STORAGE_KEYS.ENABLE) as boolean | undefined;
            log.info(`handleAuthentication: Enable status: ${enableStatus}`);

            if (enableStatus === undefined) {
              elements.enablePopup.checked = true;
              await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: true });
            } else {
              elements.enablePopup.checked = enableStatus;
            }

            elements.enablePopup.addEventListener("change", async () => {
              if (elements.enablePopup) {
                log.info(`handleAuthentication: Enable popup switch changed to ${elements.enablePopup.checked}`);
                await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: elements.enablePopup.checked });
              }
            });
          }

          if (baekjoonHubHook && elements.repoUrl) {
            elements.repoUrl.innerHTML = `Your Repo: <a target='_blank' style='color: cadetblue !important;' href='https://github.com/${baekjoonHubHook}'>${baekjoonHubHook}</a>`;
          }
        } else {
          log.info("handleAuthentication: Mode is not 'commit', showing hook mode UI.");
          hideElement(elements.commitMode);
          showElement(elements.hookMode);
        }
      } else if (response.status === 401) {
        log.info("handleAuthentication: Bad OAuth token (401), resetting and re-authenticating.");
        await saveObjectInLocalStorage({ [STORAGE_KEYS.TOKEN]: null });
        log.info("BAD oAuth!!! Redirecting back to oAuth process");
        isAuthActionAllowed = true;
        showElement(elements.authMode);
        hideElement(elements.hookMode);
        hideElement(elements.commitMode);
      } else {
        log.error("handleAuthentication: Authentication failed with status:", response.status);
      }
    } catch (error) {
      log.error("handleAuthentication: Error during authentication:", error);
    }
  }
}

/**
 * Set settings and hook page URLs
 */
function setSettingsAndHookUrls(): void {
  log.info("setSettingsAndHookUrls: Setting settings and hook URLs.");
  const elements = getElements();
  const extensionUrl = `chrome-extension://${chrome.runtime.id}/settings.html`;

  if (elements.settingsUrl) {
    elements.settingsUrl.setAttribute("href", extensionUrl);
  }
  if (elements.hookUrl) {
    elements.hookUrl.setAttribute("href", extensionUrl);
  }
}

/**
 * Handle authenticate button click
 */
function handleAuthenticateClick(): void {
  log.info(`DOMContentLoaded: Authenticate button clicked. isAuthActionAllowed: ${isAuthActionAllowed}`);
  if (isAuthActionAllowed) {
    beginOAuth2();
  }
}

/**
 * Handle storage changes
 */
function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  namespace: string
): void {
  log.info("chrome.storage.onChanged: Storage change detected.", changes);
  if (namespace === "local" && (changes[STORAGE_KEYS.TOKEN] || changes[STORAGE_KEYS.MODE_TYPE])) {
    log.info("chrome.storage.onChanged: Relevant storage key changed, re-running authentication handler.");
    handleAuthentication();
  }
}

/**
 * Initialize popup
 */
function init(): void {
  log.info("DOMContentLoaded: Initializing popup page.");

  const authenticateBtn = document.querySelector("#authenticate");
  if (authenticateBtn) {
    authenticateBtn.addEventListener("click", handleAuthenticateClick);
  }

  setSettingsAndHookUrls();
  handleAuthentication();
}

// DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", init);

// Storage change listener
chrome.storage.onChanged.addListener(handleStorageChange);
