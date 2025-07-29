import beginOAuth2 from "@/commons/oauth2.js";
import log from "@/commons/logger.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage.js";

let isAuthActionAllowed = false;

/**
 * GitHub 인증 흐름을 처리합니다.
 */
const handleAuthentication = async () => {
  log.info("handleAuthentication: Starting GitHub authentication flow.");
  const token = await getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);
  log.info(`handleAuthentication: Token status - ${token ? "exists" : "null"}`);

  const authModeElement = document.querySelector("#auth_mode");
  const hookModeElement = document.querySelector("#hook_mode");
  const commitModeElement = document.querySelector("#commit_mode");
  const repoUrlElement = document.querySelector("#repo_url");

  if (token === null || token === undefined) {
    log.info("handleAuthentication: Token is null or undefined, showing authorization mode.");
    isAuthActionAllowed = true;
    if (authModeElement) {
      authModeElement.style.display = "block";
      authModeElement.removeAttribute("hidden");
    }
    if (hookModeElement) hookModeElement.style.display = "none";
    if (commitModeElement) commitModeElement.style.display = "none";
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
        const data = await getObjectFromLocalStorage([STORAGE_KEYS.MODE_TYPE, STORAGE_KEYS.HOOK]);
        const modeType = data[STORAGE_KEYS.MODE_TYPE];
        const baekjoonHubHook = data[STORAGE_KEYS.HOOK];
        log.info(`handleAuthentication: Retrieved modeType=${modeType}, baekjoonHubHook=${baekjoonHubHook}`);

        if (authModeElement) authModeElement.style.display = "none";

        if (modeType === "commit") {
          log.info("handleAuthentication: Mode is 'commit', showing commit mode UI.");
          if (hookModeElement) hookModeElement.style.display = "none";
          if (commitModeElement) {
            commitModeElement.style.display = "block";
            commitModeElement.removeAttribute("hidden");

            // Enable switch logic for popup
            const enablePopupCheckbox = document.querySelector("#enable_popup");
            if (enablePopupCheckbox) {
              const enableStatus = await getObjectFromLocalStorage(STORAGE_KEYS.ENABLE);
              log.info(`handleAuthentication: Enable status: ${enableStatus}`);
              if (enableStatus === undefined) {
                enablePopupCheckbox.checked = true; // Default to true
                await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: true });
              } else {
                enablePopupCheckbox.checked = enableStatus;
              }

              enablePopupCheckbox.addEventListener("change", async () => {
                log.info(`handleAuthentication: Enable popup switch changed to ${enablePopupCheckbox.checked}`);
                await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: enablePopupCheckbox.checked });
              });
            }
          }
          if (baekjoonHubHook && repoUrlElement) {
            repoUrlElement.innerHTML = `Your Repo: <a target='_blank' style='color: cadetblue !important;' href='https://github.com/${baekjoonHubHook}'>${baekjoonHubHook}</a>`;
          }
        } else {
          log.info("handleAuthentication: Mode is not 'commit', showing hook mode UI.");
          if (commitModeElement) commitModeElement.style.display = "none";
          if (hookModeElement) {
            hookModeElement.style.display = "block";
            hookModeElement.removeAttribute("hidden");
          }
        }
      } else if (response.status === 401) {
        log.info("handleAuthentication: Bad OAuth token (401), resetting and re-authenticating.");
        // Bad OAuth token, reset and re-authenticate
        await saveObjectInLocalStorage({ [STORAGE_KEYS.TOKEN]: null });
        log.info("BAD oAuth!!! Redirecting back to oAuth process");
        isAuthActionAllowed = true;
        if (authModeElement) {
          authModeElement.style.display = "block";
          authModeElement.removeAttribute("hidden");
        }
        if (hookModeElement) hookModeElement.style.display = "none";
        if (commitModeElement) commitModeElement.style.display = "none";
      } else {
        log.error("handleAuthentication: Authentication failed with status:", response.status);
        // Handle other errors if necessary
      }
    } catch (error) {
      log.error("handleAuthentication: Error during authentication:", error);
      // Handle network errors or other exceptions
    }
  }
};

/**
 * 설정 및 훅 페이지 URL을 설정합니다.
 */
const setSettingsAndHookUrls = () => {
  log.info("setSettingsAndHookUrls: Setting settings and hook URLs.");
  document.querySelector("#settings_URL").setAttribute("href", `chrome-extension://${chrome.runtime.id}/settings.html`);
  document.querySelector("#hook_URL").setAttribute("href", `chrome-extension://${chrome.runtime.id}/settings.html`);
};

// DOMContentLoaded 이벤트 리스너
document.addEventListener("DOMContentLoaded", () => {
  log.info("DOMContentLoaded: Initializing popup page.");
  document.querySelector("#authenticate").addEventListener("click", () => {
    log.info(`DOMContentLoaded: Authenticate button clicked. isAuthActionAllowed: ${isAuthActionAllowed}`);
    if (isAuthActionAllowed) {
      beginOAuth2();
    }
  });

  setSettingsAndHookUrls();
  handleAuthentication();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  log.info("chrome.storage.onChanged: Storage change detected.", changes);
  if (namespace === "local" && (changes[STORAGE_KEYS.TOKEN] || changes[STORAGE_KEYS.MODE_TYPE])) {
    log.info("chrome.storage.onChanged: Relevant storage key changed, re-running authentication handler.");
    handleAuthentication();
  }
});
