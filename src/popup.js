/* global oAuth2 */
/* eslint no-undef: "error" */

// DOM utility functions to replace jQuery
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Replace jQuery functions with native DOM equivalents
const showElement = (selector) => { $(selector).style.display = 'block'; };
const setHTML = (selector, html) => { $(selector).innerHTML = html; };
const getChecked = (selector) => $(selector).checked;
const setChecked = (selector, checked) => { $(selector).checked = checked; };
const setAttr = (selector, attr, value) => { $(selector).setAttribute(attr, value); };

let action = false;

// Event listener for authentication button
document.addEventListener('DOMContentLoaded', () => {
  // Add click event listener to authenticate button
  $("#authenticate").addEventListener("click", () => {
    if (action) {
      oAuth2.begin();
    }
  });

  // Add click event listener to on/off switch
  $("#onffbox").addEventListener("click", () => {
    chrome.storage.local.set({ bjhEnable: getChecked("#onffbox") }, () => {});
  });

  /* Get URL for settings page */
  setAttr("#settings_URL", "href", `chrome-extension://${chrome.runtime.id}/settings.html`);
  setAttr("#hook_URL", "href", `chrome-extension://${chrome.runtime.id}/welcome.html`);

  chrome.storage.local.get("BaekjoonHub_token", (data) => {
    const token = data.BaekjoonHub_token;
    if (token === null || token === undefined) {
      action = true;
      showElement("#auth_mode");
    } else {
      // To validate user, load user object from GitHub.
      const AUTHENTICATION_URL = "https://api.github.com/user";

      const xhr = new XMLHttpRequest();
      xhr.addEventListener("readystatechange", function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            /* Show MAIN FEATURES */
            chrome.storage.local.get("mode_type", (data2) => {
              if (data2 && data2.mode_type === "commit") {
                showElement("#commit_mode");
                /* Get problem stats and repo link */
                chrome.storage.local.get(["stats", "BaekjoonHub_hook"], (data3) => {
                  const BaekjoonHubHook = data3.BaekjoonHub_hook;
                  if (BaekjoonHubHook) {
                    setHTML("#repo_url", `Your Repo: <a target="blank" style="color: cadetblue !important;" href="https://github.com/${BaekjoonHubHook}">${BaekjoonHubHook}</a>`);
                  }
                });
              } else {
                showElement("#hook_mode");
              }
            });
          } else if (xhr.status === 401) {
            // bad oAuth
            // reset token and redirect to authorization process again!
            chrome.storage.local.set({ BaekjoonHub_token: null }, () => {
              console.log("BAD oAuth!!! Redirecting back to oAuth process");
              action = true;
              showElement("#auth_mode");
            });
          }
        }
      });
      xhr.open("GET", AUTHENTICATION_URL, true);
      xhr.setRequestHeader("Authorization", `token ${token}`);
      xhr.send();
    }
  });

  /*
    초기에 활성화 데이터가 존재하는지 확인, 없으면 새로 생성, 있으면 있는 데이터에 맞게 버튼 조정
  */
  chrome.storage.local.get("bjhEnable", (data4) => {
    if (data4.bjhEnable === undefined) {
      setChecked("#onffbox", true);
      chrome.storage.local.set({ bjhEnable: getChecked("#onffbox") }, () => {});
    } else {
      setChecked("#onffbox", data4.bjhEnable);
      chrome.storage.local.set({ bjhEnable: getChecked("#onffbox") }, () => {});
    }
  });
});