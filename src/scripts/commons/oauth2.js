import { saveObjectInLocalStorage } from "./storage.js";
import urls from "@/constants/url.js";
import { STORAGE_KEYS } from "@/constants/registry.js";

const AUTHORIZATION_URL = urls.GITHUB_AUTHORIZATION_URL;
const CLIENT_ID = urls.GITHUB_CLIENT_ID;
const REDIRECT_URL = urls.GITHUB_REDIRECT_URL;
const SCOPES = ["repo"];

/**
 * Begin
 */
export default function beginOAuth2() {
  let url = `${AUTHORIZATION_URL}?client_id=${CLIENT_ID}&redirect_uri${REDIRECT_URL}&scope=`;

  for (let i = 0; i < SCOPES.length; i += 1) {
    url += SCOPES[i];
  }

  saveObjectInLocalStorage({ [STORAGE_KEYS.PIPE]: true }).then(() => {
    // opening pipe temporarily

    chrome.tabs.create({ url, selected: true }, (tab) => {
      window.close();
      chrome.tabs.getCurrent((tab) => {
        // chrome.tabs.remove(tab.id, function () {});
      });
    });
  });
}
