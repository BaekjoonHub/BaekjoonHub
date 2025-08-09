import { isNull } from "@/commons/util.js";
import { uploadState } from "@/programmers/variables.js";
import { Toast } from "@/commons/toast.js";
import log from "@/commons/logger.js";

/**
 * 업로드 시작 알림
 */
export function startUpload() {
  Toast.info("🚀 GitHub 업로드를 시작합니다!", 3000);
  log.debug("startUpload: Upload start toast displayed");
}

/**
 * 업로드 완료 알림
 * @param {object} branches - 브랜치 정보
 * @param {string} directory - 디렉토리 정보
 */
export function markUploadedCSS(branches, directory) {
  if (uploadState) {
    uploadState.uploading = false;
  }

  // directory가 undefined인 경우 처리
  if (!directory) {
    log.warn("markUploadedCSS called with undefined directory");
    return;
  }

  // GitHub 링크 생성
  const repoName = Object.keys(branches)[0];
  const branchName = branches[repoName];
  const uploadedUrl = `https://github.com/${repoName}/tree/${branchName}/${directory}`;

  // 성공 Toast에 클릭 가능한 링크 표시
  const directoryParts = directory.split("/");
  const problemInfo = directoryParts[directoryParts.length - 1] || directory;
  const successMessage = `✨ 업로드 성공! ${problemInfo}`;
  const toast = Toast.success(successMessage, 8000);

  // Toast 클릭 시 GitHub 페이지로 이동
  if (toast && toast.element) {
    toast.element.style.cursor = "pointer";

    // 클릭 가능한 시각적 히트 추가
    const linkIcon = document.createElement("div");
    linkIcon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-left: 8px; opacity: 0.8;">
        <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
        <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
      </svg>
    `;
    linkIcon.style.display = "inline-block";
    linkIcon.style.verticalAlign = "middle";

    const messageContainer = toast.element.querySelector(".message-container");
    const textSpan = messageContainer.querySelector("span");
    if (textSpan) {
      textSpan.appendChild(linkIcon);
    }

    // 안내 텍스트 추가
    const infoText = document.createElement("div");
    infoText.style.cssText = `
      font-size: 13px;
      opacity: 0.8;
      margin-top: 6px;
      font-weight: 400;
    `;
    infoText.textContent = "클릭하여 GitHub에서 확인 →";
    messageContainer.appendChild(infoText);

    toast.element.addEventListener("click", () => {
      window.open(uploadedUrl, "_blank");
    });
  }

  log.debug("markUploadedCSS: Upload success toast displayed");
}

/**
 * 업로드 실패 알림
 */
export function markUploadFailedCSS() {
  if (uploadState) {
    uploadState.uploading = false;
  }

  Toast.danger("🚫 업로드 실패! 다시 시도해주세요.", 5000);
  log.debug("markUploadFailedCSS: Upload failure toast displayed");
}
