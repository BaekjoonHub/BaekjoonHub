import { initUploadUI, markUploadedCSS as markUploaded, markUploadFailedCSS as markFailed, getDateString } from '../ui-util.js';

/**
 * 로딩 버튼 추가
 */
function startUpload() {
  const target = document.querySelector('#modal-dialog > div.modal-dialog > div.modal-content > div.modal-footer');
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
function markUploadedCSS(branches, directory) {
  markUploaded(branches, directory, uploadState);
}

/**
 * 업로드 실패 아이콘 표시
 */
function markUploadFailedCSS() {
  markFailed(uploadState);
}

// getDateString 함수는 이제 ui-util.js에서 import됩니다.
