/** NOTE: goormlevel에서 사용할 util 모음입니다. */

/**
 * 로딩 버튼 추가
 */
function startUpload() {
  /**
   * goormlevel 에는 확장이 심는 anchor 가 처음엔 없으므로 직접 만든다.
   * #349: 기존 코드는 getElementById 의 반환값을 undefined 와 비교했는데 실제 반환값은 null 이라
   * 분기가 항상 참이었다. 파싱 실패 재시도가 생긴 뒤로는 그 때문에 anchor 가 중복 생성되므로 바로잡는다.
   */
  let anchor = document.getElementById('BaekjoonHub_progress_anchor_element');
  if (isNull(anchor)) {
    anchor = document.createElement('span');
    anchor.id = 'BaekjoonHub_progress_anchor_element';
    anchor.className = 'runcode-wrapper__8rXm';
    anchor.style = 'margin-left: 10px;padding-top: 0px;';
  }
  anchor.innerHTML = `<div id="BaekjoonHub_progress_elem" class="BaekjoonHub_progress"></div>`;

  /** 정답을 맞추면 렌더링되는 target element */
  const target = [...document.querySelectorAll('#FrameBody div > p[class] > span')].find(($element) => $element.textContent === '정답입니다.');
  if (isNull(anchor.parentElement) && !isNull(target)) {
    target.append(anchor);
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
  clearTimeout(uploadState.countdown);
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  /* #349: startUpload 가 anchor 를 붙일 자리를 찾지 못했다면 elem 이 없다.
     여기서 TypeError 가 나면 그 예외마저 조용히 삼켜지므로 반드시 가드한다. */
  if (isNull(elem)) return;
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
  clearTimeout(uploadState.countdown);
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  /* #349: 이 함수는 이제 startUpload() 보다 먼저 호출될 수 있다(파싱 실패 경로).
     elem 이 없다고 여기서 터지면 다시 무음 실패가 되므로 조용히 반환한다. */
  if (isNull(elem)) return;
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
