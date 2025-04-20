import { initUploadUI, markUploadedCSS as markUploaded, markUploadFailedCSS as markFailed, getDateString } from '../ui-util.js';

/**
 * 로딩 버튼 추가
 */
function startUpload() {
  const target = document.querySelector('div.box-list > div.box-list-inner > div.right_answer > span.btn_right');
  if (!isNull(target)) {
    const container = initUploadUI(target, uploadState);
    if (container) {
      target.prepend(container);
    }
  }
}

/**
 * SWEA 플랫폼에서 접근이 좋은 업로드 버튼 생성
 * @param {string} link - 업로드 시 이동할 링크
 */
function makeSubmitButton(link) {
  let elem = document.getElementById('BaekjoonHub_submit_button_element');
  if (elem !== undefined) {
    elem = document.createElement('a');
    elem.id = 'BaekjoonHub_submit_button_element';
    elem.className = 'btn_grey3 md btn';
    elem.style = 'cursor:pointer';
    elem.href = link;
  }
  elem.innerHTML = '백준허브로 업로드';
  const target = document.querySelector('body > div.popup_layer.show > div > div');
  if (!isNull(target)) {
    target.append(elem);
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

/**
 * 로그인한 유저의 닉네임을 가져옵니다.
 * @returns {string} 유저 닉네임이며 없을 시에 null을 반환
 */
function getNickname() {
  return document.querySelector('#Beginner')?.innerText || document.querySelector('header > div > span.name')?.innerText || '';
}

// getDateString 함수는 이제 ui-util.js에서 import됩니다.
