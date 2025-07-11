import urls from "@/constants/url.js";

/*
    (needs patch)
    IMPLEMENTATION OF AUTHENTICATION ROUTE AFTER REDIRECT FROM GITHUB.
*/

const KEY = "BaekjoonHub_token";
const ACCESS_TOKEN_URL = urls.GITHUB_ACCESS_TOKEN_URL;
const CLIENT_ID = urls.GITHUB_CLIENT_ID;
const CLIENT_SECRET = urls.GITHUB_CLIENT_SECRET;

/**
 * Finish
 *
 * @param token The OAuth2 token given to the application from the provider.
 */
async function finish(token) {
  const AUTHENTICATION_URL = urls.GITHUB_API_USER_URL;
  try {
    const response = await fetch(AUTHENTICATION_URL, {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
      },
    });
    if (response.ok) {
      const { login: username } = await response.json();
      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: true,
        token,
        username,
        KEY,
      });
    } else {
      console.error("Failed to fetch user data:", response.status, response.statusText);
      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: false,
      });
    }
  } catch (error) {
    console.error("Error during authentication:", error);
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
      },
    });

    if (response.ok) {
      const data = await response.json();
      finish(data.access_token);
    } else {
      console.error("Failed to request token:", response.status, response.statusText);
      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: false,
      });
    }
  } catch (error) {
    console.error("Error during token request:", error);
    chrome.runtime.sendMessage({
      closeWebPage: true,
      isSuccess: false,
    });
  }
}

export default function parseAccessCode(url) {
  if (url.match(/\?error=(.+)/)) {
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.remove(tab.id, () => {});
    });
  } else {
    // eslint-disable-next-line
    const accessCode = url.match(/\?code=([\w\/\-]+)/);
    if (accessCode) {
      requestToken(accessCode[1]);
    }
  }
}

const link = window.location.href;

/* Check for open pipe */
if (window.location.host === "github.com") {
  chrome.storage.local.get("pipeBaekjoonhub", (data) => {
    if (data && data.pipe_baekjoonhub) {
      parseAccessCode(link);
    }
  });
}
