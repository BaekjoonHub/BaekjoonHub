import urls from "@/constants/url.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import log from "@/commons/logger.js";

/*
    (needs patch)
    IMPLEMENTATION OF AUTHENTICATION ROUTE AFTER REDIRECT FROM GITHUB.
*/

const KEY = STORAGE_KEYS.TOKEN;
const ACCESS_TOKEN_URL = urls.GITHUB_ACCESS_TOKEN_URL;
const CLIENT_ID = urls.GITHUB_CLIENT_ID;
const CLIENT_SECRET = urls.GITHUB_CLIENT_SECRET;

/**
 * Finish
 *
 * @param token The OAuth2 token given to the application from the provider.
 */
async function finish(token) {
  log.info("authorize.js: Entering finish function.");
  log.debug("authorize.js: finish function called with token:", token);
  const AUTHENTICATION_URL = urls.GITHUB_API_USER_URL;
  try {
    const response = await fetch(AUTHENTICATION_URL, {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
      },
    });
    log.debug("authorize.js: finish fetch response status:", response.status);
    if (response.ok) {
      const { login: username } = await response.json();
      log.info("authorize.js: Successfully fetched user data.");
      log.debug("authorize.js: Sending message to background script (success)");
      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: true,
        token,
        username,
        KEY,
      });
    } else {
      log.info("authorize.js: Failed to fetch user data.");
      log.error("authorize.js: Failed to fetch user data:", response.status, response.statusText);
      log.debug("authorize.js: Sending message to background script (failure)");
      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: false,
      });
    }
  } catch (error) {
    log.info("authorize.js: Error during authentication.");
    log.error("authorize.js: Error during authentication:", error);
    log.debug("authorize.js: Sending message to background script (error)");
    chrome.runtime.sendMessage({
      closeWebPage: true,
      isSuccess: false,
    });
  }
}

/**
 * Request Token
 *
 * @param code The access code returned by provider.
 */
async function requestToken(code) {
  log.info("authorize.js: Entering requestToken function.");
  log.debug("authorize.js: requestToken function called with code:", code);
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);
  params.append("code", code);

  try {
    const response = await fetch(ACCESS_TOKEN_URL, {
      method: "POST",
      body: params,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    log.debug("authorize.js: requestToken fetch response status:", response.status);
    if (response.ok) {
      const data = await response.json();
      log.info("authorize.js: Token request successful.");
      log.debug("authorize.js: Token request successful, calling finish with access_token:", data.access_token);
      finish(data.access_token);
    } else {
      log.info("authorize.js: Failed to request token.");
      log.error("authorize.js: Failed to request token:", response.status, response.statusText);
      log.debug("authorize.js: Sending message to background script (failure)");
      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: false,
      });
    }
  } catch (error) {
    log.info("authorize.js: Error during token request.");
    log.error("authorize.js: Error during token request:", error);
    log.debug("authorize.js: Sending message to background script (error)");
    chrome.runtime.sendMessage({
      closeWebPage: true,
      isSuccess: false,
    });
  }
}

export default function parseAccessCode(url) {
  log.info("authorize.js: Entering parseAccessCode function.");
  log.debug("authorize.js: parseAccessCode called with url:", url);
  if (url.match(/\?error=(.+)/)) {
    log.debug("authorize.js: URL contains error parameter");
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.remove(tab.id, () => {});
    });
  } else {
    // eslint-disable-next-line
    const accessCode = url.match(/\?code=([\w\/\-]+)/);
    if (accessCode) {
      log.debug("authorize.js: Access code found, requesting token");
      requestToken(accessCode[1]);
    } else {
      log.debug("authorize.js: No access code found in URL");
    }
  }
}

const link = window.location.href;

/* Check for open pipe */
if (window.location.host === "github.com") {
  log.info("authorize.js: Running on github.com. Checking for pipe.");
  log.debug("authorize.js: Running on github.com, checking for pipe");
  chrome.storage.local.get(STORAGE_KEYS.PIPE, (data) => {
    if (data && data[STORAGE_KEYS.PIPE]) {
      log.debug("authorize.js: Pipe found, parsing access code");
      parseAccessCode(link);
    } else {
      log.debug("authorize.js: No pipe found");
    }
  });
} else {
  log.debug("authorize.js: Not running on github.com");
}
