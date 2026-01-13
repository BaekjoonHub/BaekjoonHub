/**
 * GitHub OAuth2 flow initiator
 * Begins the authentication process by opening GitHub authorization page
 */
import { saveObjectInLocalStorage } from "./storage";
import urls from "@/constants/url";
import { STORAGE_KEYS } from "@/constants/registry";
import log from "./logger";

const AUTHORIZATION_URL = urls.GITHUB_AUTHORIZATION_URL;
const CLIENT_ID = urls.GITHUB_CLIENT_ID;
const REDIRECT_URL = urls.GITHUB_REDIRECT_URL;
const SCOPES: readonly string[] = ["repo"] as const;

/**
 * Begin GitHub OAuth2 authentication flow
 * Opens a new tab with GitHub authorization URL
 */
export default async function beginOAuth2(): Promise<void> {
  log.info("OAuth2: beginOAuth2 function called.");

  // Build authorization URL with scopes
  let url = `${AUTHORIZATION_URL}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&scope=`;

  for (let i = 0; i < SCOPES.length; i += 1) {
    url += SCOPES[i];
  }

  // Open pipe for authorization callback
  await saveObjectInLocalStorage({ [STORAGE_KEYS.PIPE]: true });

  log.info("OAuth2: Attempting to create new tab with URL:", url);

  // Open GitHub authorization page
  chrome.tabs.create({ url, active: true }, () => {
    chrome.tabs.getCurrent(() => {
      // Tab handling after OAuth redirect
    });
  });
}
