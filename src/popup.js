import beginOAuth2 from "@/commons/oauth2.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage.js";

let isAuthActionAllowed = false;

/**
 * GitHub 인증 흐름을 처리합니다.
 */
const handleAuthentication = async () => {
  const token = await getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);

  if (token === null || token === undefined) {
    isAuthActionAllowed = true;
    document.querySelector("#auth_mode").style.display = "block";
    document.querySelector("#auth_mode").removeAttribute("hidden");
  } else {
    const AUTHENTICATION_URL = "https://api.github.com/user";
    try {
      const response = await fetch(AUTHENTICATION_URL, {
        method: "GET",
        headers: {
          Authorization: `token ${token}`,
        },
      });

      if (response.ok) {
        const data2 = await getObjectFromLocalStorage(STORAGE_KEYS.MODE_TYPE);
        if (data2 && data2.mode_type === "commit") {
          document.querySelector("#commit_mode").style.display = "block";
          document.querySelector("#commit_mode").removeAttribute("hidden");
          const data3 = await getObjectFromLocalStorage([STORAGE_KEYS.STATS, STORAGE_KEYS.HOOK]);
          const { baekjoonHubHook } = data3;
          if (baekjoonHubHook) {
            document.querySelector("#repo_url").innerHTML = `Your Repo: <a target='_blank' style='color: cadetblue !important;' href='https://github.com/${baekjoonHubHook}'>${baekjoonHubHook}</a>`;
          }
        } else {
          document.querySelector("#hook_mode").style.display = "block";
          document.querySelector("#hook_mode").removeAttribute("hidden");
        }
      } else if (response.status === 401) {
        // Bad OAuth token, reset and re-authenticate
        await saveObjectInLocalStorage({ [STORAGE_KEYS.TOKEN]: null });
        console.log("BAD oAuth!!! Redirecting back to oAuth process");
        isAuthActionAllowed = true;
        document.querySelector("#auth_mode").style.display = "block";
        document.querySelector("#auth_mode").removeAttribute("hidden");
      } else {
        console.error("Authentication failed with status:", response.status);
        // Handle other errors if necessary
      }
    } catch (error) {
      console.error("Error during authentication:", error);
      // Handle network errors or other exceptions
    }
  }
};

/**
 * 기능 활성화/비활성화 스위치를 초기화합니다.
 */
const initializeOnOffSwitch = async () => {
  const bjhEnable = await getObjectFromLocalStorage(STORAGE_KEYS.ENABLE);
  if (bjhEnable === undefined) {
    document.querySelector("#onffbox").checked = true;
    saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: document.querySelector("#onffbox").checked });
  } else {
    document.querySelector("#onffbox").checked = bjhEnable;
    saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: document.querySelector("#onffbox").checked });
  }

  document.querySelector("#onffbox").addEventListener("click", () => {
    saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: document.querySelector("#onffbox").checked });
  });
};

/**
 * 설정 및 훅 페이지 URL을 설정합니다.
 */
const setSettingsAndHookUrls = () => {
  document.querySelector("#settings_URL").setAttribute("href", `chrome-extension://${chrome.runtime.id}/settings.html`);
  document.querySelector("#hook_URL").setAttribute("href", `chrome-extension://${chrome.runtime.id}/settings.html`);
};

// DOMContentLoaded 이벤트 리스너
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#authenticate").addEventListener("click", () => {
    if (isAuthActionAllowed) {
      beginOAuth2();
    }
  });

  setSettingsAndHookUrls();
  handleAuthentication();
  initializeOnOffSwitch();
});
