/**
 * GitHub OAuth2 authorization handler
 * Implements authentication route after redirect from GitHub
 */
import urls from "@/constants/url";
import { STORAGE_KEYS } from "@/constants/registry";
import log from "@/commons/logger";

const KEY = STORAGE_KEYS.TOKEN;
const ACCESS_TOKEN_URL = urls.GITHUB_ACCESS_TOKEN_URL;
const CLIENT_ID = urls.GITHUB_CLIENT_ID;
const CLIENT_SECRET = urls.GITHUB_CLIENT_SECRET;

// GitHub user response interface
interface GitHubUserResponse {
  login: string;
  id: number;
  name?: string;
  email?: string;
}

// Token response interface
interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

/**
 * Complete the authentication process
 * @param token - OAuth2 token from GitHub
 */
async function finish(token: string): Promise<void> {
  log.info("authorize.ts: Entering finish function.");
  log.debug("authorize.ts: finish function called with token:", token);

  const AUTHENTICATION_URL = urls.GITHUB_API_USER_URL;

  try {
    const response = await fetch(AUTHENTICATION_URL, {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
      },
    });

    log.debug("authorize.ts: finish fetch response status:", response.status);

    if (response.ok) {
      const data: GitHubUserResponse = await response.json();
      const username = data.login;
      log.info("authorize.ts: Successfully fetched user data.");
      log.debug("authorize.ts: Sending message to background script (success)");

      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: true,
        token,
        username,
        KEY,
      });
    } else {
      log.info("authorize.ts: Failed to fetch user data.");
      log.error("authorize.ts: Failed to fetch user data:", response.status, response.statusText);
      log.debug("authorize.ts: Sending message to background script (failure)");

      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: false,
      });
    }
  } catch (error) {
    log.info("authorize.ts: Error during authentication.");
    log.error("authorize.ts: Error during authentication:", error);
    log.debug("authorize.ts: Sending message to background script (error)");

    chrome.runtime.sendMessage({
      closeWebPage: true,
      isSuccess: false,
    });
  }
}

/**
 * Request OAuth2 token from GitHub
 * @param code - Access code from GitHub redirect
 */
async function requestToken(code: string): Promise<void> {
  log.info("authorize.ts: Entering requestToken function.");
  log.debug("authorize.ts: requestToken function called with code:", code);

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

    log.debug("authorize.ts: requestToken fetch response status:", response.status);

    if (response.ok) {
      const data: TokenResponse = await response.json();
      log.info("authorize.ts: Token request successful.");
      log.debug("authorize.ts: Token request successful, calling finish with access_token");
      finish(data.access_token);
    } else {
      log.info("authorize.ts: Failed to request token.");
      log.error("authorize.ts: Failed to request token:", response.status, response.statusText);
      log.debug("authorize.ts: Sending message to background script (failure)");

      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: false,
      });
    }
  } catch (error) {
    log.info("authorize.ts: Error during token request.");
    log.error("authorize.ts: Error during token request:", error);
    log.debug("authorize.ts: Sending message to background script (error)");

    chrome.runtime.sendMessage({
      closeWebPage: true,
      isSuccess: false,
    });
  }
}

/**
 * Parse access code from redirect URL
 * @param url - URL containing access code
 */
export default function parseAccessCode(url: string): void {
  log.info("authorize.ts: Entering parseAccessCode function.");
  log.debug("authorize.ts: parseAccessCode called with url:", url);

  if (url.match(/\?error=(.+)/)) {
    log.debug("authorize.ts: URL contains error parameter");
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id) {
        chrome.tabs.remove(tab.id);
      }
    });
  } else {
    const accessCode = url.match(/\?code=([\w/\-]+)/);
    if (accessCode) {
      log.debug("authorize.ts: Access code found, requesting token");
      requestToken(accessCode[1]);
    } else {
      log.debug("authorize.ts: No access code found in URL");
    }
  }
}

// Auto-execute on GitHub redirect
const link = window.location.href;

// Check for open pipe
if (window.location.host === "github.com") {
  log.info("authorize.ts: Running on github.com. Checking for pipe.");
  log.debug("authorize.ts: Running on github.com, checking for pipe");

  chrome.storage.local.get(STORAGE_KEYS.PIPE, (data) => {
    if (data && data[STORAGE_KEYS.PIPE]) {
      log.debug("authorize.ts: Pipe found, parsing access code");
      parseAccessCode(link);
    } else {
      log.debug("authorize.ts: No pipe found");
    }
  });
} else {
  log.debug("authorize.ts: Not running on github.com");
}
