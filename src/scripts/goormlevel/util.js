/** NOTE: goormlevel에서 사용할 util 모음입니다. */

import { initUploadUI, markUploadedCSS as markUploaded, markUploadFailedCSS as markFailed, getDateString } from '../ui-util.js';

/**
 * 로딩 버튼 추가
 */
function startUpload() {
  /** 정답을 맞추면 렌더링되는 target element */
  const target = [...document.querySelectorAll('#FrameBody div > p[class] > span')].find(($element) => $element.textContent === '정답입니다.');
  if (!isNull(target)) {
    initUploadUI(target, uploadState);
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
