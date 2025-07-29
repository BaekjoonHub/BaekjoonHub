import { saveObjectInLocalStorage } from "./storage.js";
import urls from "@/constants/url.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import log from "./logger.js";

const AUTHORIZATION_URL = urls.GITHUB_AUTHORIZATION_URL;
const CLIENT_ID = urls.GITHUB_CLIENT_ID;
const REDIRECT_URL = urls.GITHUB_REDIRECT_URL;
const SCOPES = ["repo"];

/**
 * Begin
 */
export default async function beginOAuth2() {
  log.info("OAuth2: beginOAuth2 function called.");
  let url = `${AUTHORIZATION_URL}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&scope=`;

  for (let i = 0; i < SCOPES.length; i += 1) {
    url += SCOPES[i];
  }

  await saveObjectInLocalStorage({ [STORAGE_KEYS.PIPE]: true });
  // opening pipe temporarily

  log.info("OAuth2: Attempting to create new tab with URL:", url);
  chrome.tabs.create({ url, selected: true }, (tab) => {
    // window.close(); // Temporarily removed for debugging
    chrome.tabs.getCurrent((tab) => {
      // chrome.tabs.remove(tab.id, function () {});
    });
  });
}
