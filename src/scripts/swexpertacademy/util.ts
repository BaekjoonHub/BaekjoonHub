/**
 * SWEA platform utility functions
 * Handles UI notifications using shared upload-notifications service
 */
import { isNull } from "@/commons/util";
import { uploadState } from "@/swexpertacademy/variables";
import { createUploadNotifications } from "@/commons/upload-notifications";
import { Toast } from "@/commons/toast";
import log from "@/commons/logger";

// Create notification service for SWEA
const notifications = createUploadNotifications("SWEA", uploadState);

/**
 * Show upload start notification
 */
export function startUpload(): void {
  notifications.startUpload();
  log.debug("startUpload: Upload start toast displayed");
}

/**
 * Create a submit button for manual upload on SWEA platform
 * @param link - Link for navigation (not used when uploadHandler is provided)
 * @param uploadHandler - Optional upload handler function
 */
export function makeSubmitButton(
  link: string,
  uploadHandler: (() => Promise<void>) | null = null
): void {
  let elem = document.getElementById("baekjoonHubSubmitButtonElement") as HTMLButtonElement | null;

  if (elem === null) {
    elem = document.createElement("button");
    elem.id = "baekjoonHubSubmitButtonElement";
    elem.className = "btn_grey3 md btn";
    elem.style.cssText = "cursor:pointer; margin: 10px;";
    elem.textContent = "GitHub에 업로드";
    elem.type = "button";

    // Add click event
    elem.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (uploadHandler) {
        const button = elem as HTMLButtonElement;
        try {
          button.disabled = true;
          button.textContent = "업로드 중...";
          button.style.opacity = "0.6";

          log.info("수동 업로드 버튼 클릭됨");
          await uploadHandler();
        } catch (error) {
          log.error("수동 업로드 중 오류:", error);
          Toast.danger("업로드 중 오류가 발생했습니다.", 5000);
        } finally {
          button.disabled = false;
          button.textContent = "GitHub에 업로드";
          button.style.opacity = "1";
        }
      } else {
        // Original behavior (navigate to another page)
        window.location.href = link;
      }
    });
  }

  const target = document.querySelector("body > div.popup_layer.show > div > div");
  if (!isNull(target) && !target.contains(elem)) {
    target.append(elem);
  }
}

/**
 * Show upload success notification with GitHub link
 * @param branches - Branch info (repoName: branchName)
 * @param directory - Directory path
 */
export function markUploadedCSS(branches: Record<string, string>, directory: string): void {
  if (!directory) {
    log.warn("markUploadedCSS called with undefined directory");
    return;
  }

  notifications.markUploadSuccess(branches, directory);
  log.debug("markUploadedCSS: Upload success toast displayed");
}

/**
 * Show upload failure notification
 */
export function markUploadFailedCSS(): void {
  notifications.markUploadFailed();
  log.debug("markUploadFailedCSS: Upload failure toast displayed");
}

/**
 * Get logged-in user's nickname
 * @returns User nickname or empty string
 */
export function getNickname(): string {
  const beginnerEl = document.querySelector("#Beginner");
  const headerNameEl = document.querySelector("header > div > span.name");
  return beginnerEl?.textContent || headerNameEl?.textContent || "";
}
