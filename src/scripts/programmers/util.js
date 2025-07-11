import { initUploadUI, markUploadedCSS as markUploaded, markUploadFailedCSS as markFailed } from "@/commons/ui-util.js";
import { isNull } from "@/commons/util.js";
import { uploadState } from "@/programmers/variables.js";

/**
 * 로딩 버튼 추가
 */
export function startUpload() {
  const target = document.querySelector("#modal-dialog > div.modal-dialog > div.modal-content > div.modal-footer");
  if (!isNull(target)) {
    const container = initUploadUI(target, uploadState);
    if (container) {
      target.prepend(container); // 프로그래머스에서는 prepend 사용
    }
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
