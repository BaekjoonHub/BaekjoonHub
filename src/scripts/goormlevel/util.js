/** NOTE: goormlevel에서 사용할 util 모음입니다. */

import { initUploadUI, markUploadedCSS as markUploaded, markUploadFailedCSS as markFailed } from "@/commons/ui-util.js";
import { uploadState } from "@/goormlevel/variables.js";

/**
 * 로딩 버튼 추가
 */
export function startUpload() {
  /** 정답을 맞추면 렌더링되는 target element */
  const target = [...document.querySelectorAll("#FrameBody div > p[class] > span")].find(($element) => $element.textContent === "정답입니다.");
  if (target !== null) {
    initUploadUI(target, uploadState);
  }
}

/**
 * 업로드 완료 아이콘 표시 및 링크 생성
 * @param {object} branches - 브랜치 정보
 * @param {string} directory - 디렉토리 정보
 */
export function markUploadedCSS(branches, directory) {
  markUploaded(branches, directory, uploadState);
}

/**
 * 업로드 실패 아이콘 표시
 */
export function markUploadFailedCSS() {
  markFailed(uploadState);
}
