/** NOTE: goormlevel에서 사용할 util 모음입니다. */

/**
 * 로딩 버튼 추가
 */
function startUpload() {
  /**
   * goormlevel에는 항상 해당 elem이 없음
   * loader나 check DOM 관리하기 위한 DOM
   */
  let elem = document.getElementById('BaekjoonHub_progress_anchor_element');
  if (elem !== undefined) {
    /** goormlevel에서는 항상 해당 조건문을 실행함 */
    elem = document.createElement('span');
    elem.id = 'BaekjoonHub_progress_anchor_element';
    elem.className = 'runcode-wrapper__8rXm';
    elem.style = 'margin-left: 10px;padding-top: 0px;';
  }
  elem.innerHTML = `<div id="BaekjoonHub_progress_elem" class="BaekjoonHub_progress"></div>`;

  /** 정답을 맞추면 렌더링되는 target element */
  const target = [...document.querySelectorAll('#FrameBody div > p[class] > span')].find(($element) => $element.textContent === '정답입니다.');
  if (!isNull(target)) {
    target.append(elem);
  }
  // start the countdown
  startUploadCountDown();
}

/**
 * 업로드 완료 아이콘 표시 및 링크 생성
 * @param {object} branches - 브랜치 정보 ('userName/repositoryName': 'branchName')
 * @param {string} directory - 디렉토리 정보 ('백준/Gold/1. 문제이름')
 * 1. 업로드 완료 아이콘을 표시합니다.
 * 2. 아이콘 클릭 시 업로드된 GitHub 링크로 이동하는 이벤트 리스너를 등록합니다.
 */
function markUploadedCSS(branches, directory) {
  uploadState.uploading = false;
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  elem.className = 'markuploaded';
  const uploadedUrl = 'https://github.com/' + Object.keys(branches)[0] + '/tree/' + branches[Object.keys(branches)[0]] + '/' + directory;
  elem.addEventListener('click', function () {
    window.location.href = uploadedUrl;
  });
  elem.style.cursor = 'pointer';
}

/**
 * 업로드 실패 아이콘 표시
 */
function markUploadFailedCSS() {
  uploadState.uploading = false;
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  elem.className = 'markuploadfailed';
}

/**
 * 총 실행시간이 10초를 초과한다면 실패로 간주합니다.
 */
function startUploadCountDown() {
  uploadState.uploading = true;
  uploadState.countdown = setTimeout(() => {
    if (uploadState.uploading === true) {
      markUploadFailedCSS();
    }
  }, 10000);
}

/**
 * 백준의 날짜 형식과 같게 포맷된 스트링을 반환하는 함수
 * @example 2023년 9월 23일 16:26:26
 * @param {Date} date
 * @return {string} 포맷된 스트링
 */

function getDateString(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}:${seconds}`;
}
