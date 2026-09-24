/** NOTE: goormlevel에서 사용할 util 모음입니다. */

/**
 * 채점 결과(정답 span) 옆에 로딩 아이콘을 붙이고, 이번 업로드 시도(attempt)를 반환합니다.
 *
 * 구름LEVEL 은 제출할 때마다 결과 블록을 목록 맨 위에 새로 쌓고 이전 결과 블록은 지우지 않는다.
 * 그래서 아이콘은 id 로 찾지 않고 시도 객체가 붙잡은 요소로만 갱신한다. 이전 제출의 아이콘은 그 결과 옆에
 * 그대로 남아 각 제출의 업로드 결과를 보여 주고, 앞 시도의 늦은 콜백이 새 시도의 아이콘을 덮어쓰지 않는다.
 * (id 는 CSS 가 쓰므로 남겨 둔다. 여러 블록에 같은 id 가 생기지만 코드는 getElementById 를 쓰지 않는다.)
 * 워치독은 여기서 켜지 않는다. 앞 업로드 뒤에서 줄을 기다리는 동안은 로딩 아이콘을 유지하고,
 * 이 시도의 업로드가 실제로 시작될 때 enqueueUpload 가 startUploadCountDown 을 호출한다.
 * @param {HTMLElement|null} target - 아이콘을 붙일 결과 span (없으면 아이콘 없이 진행)
 * @returns {{elem: HTMLElement, done: boolean, countdown: (number|null)}}
 */
function startUpload(target) {
  const anchor = document.createElement('span');
  anchor.id = 'BaekjoonHub_progress_anchor_element';
  anchor.className = 'runcode-wrapper__8rXm';
  anchor.style = 'margin-left: 10px;padding-top: 0px;';
  const elem = document.createElement('div');
  elem.id = 'BaekjoonHub_progress_elem';
  elem.className = 'BaekjoonHub_progress';
  anchor.appendChild(elem);
  if (!isNull(target)) target.append(anchor);
  return { elem, done: false, countdown: null };
}

/**
 * 시도의 아이콘을 화면에서 떼어 냅니다. (파싱을 다시 시도하기 전에 아이콘이 쌓이지 않게 한다)
 * @param {{elem: HTMLElement, done: boolean, countdown: (number|null)}} attempt
 */
function removeUploadIcon(attempt) {
  if (isNull(attempt)) return;
  clearTimeout(attempt.countdown);
  const anchor = attempt.elem?.parentElement;
  if (!isNull(anchor)) anchor.remove();
}

/**
 * 업로드 완료 아이콘 표시 및 링크 생성
 * @param {object} branches - 브랜치 정보 ('userName/repositoryName': 'branchName')
 * @param {string} directory - 디렉토리 정보 ('백준/Gold/1. 문제이름')
 * @param {{elem: HTMLElement, done: boolean, countdown: (number|null)}} attempt - startUpload 가 돌려준 시도
 * 1. 업로드 완료 아이콘을 표시합니다.
 * 2. 아이콘 클릭 시 업로드된 GitHub 링크로 이동하는 이벤트 리스너를 등록합니다.
 */
function markUploadedCSS(branches, directory, attempt) {
  if (isNull(attempt)) return;
  attempt.done = true;
  clearTimeout(attempt.countdown);
  const elem = attempt.elem;
  /* #349: 아이콘을 붙일 자리를 찾지 못했다면 elem 이 화면에 없다.
     여기서 TypeError 가 나면 이미 성공한 커밋이 실패한 것처럼 보이므로 반드시 가드한다. */
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
 * 워치독이 띄운 실패는 "아직 끝나지 않음" 이라는 잠정 판정이므로 done 을 세우지 않는다.
 * 그 업로드가 뒤늦게 성공하면 markUploadedCSS 가 같은 아이콘을 완료로 바꾼다.
 * @param {{elem: HTMLElement, done: boolean, countdown: (number|null)}} attempt - startUpload 가 돌려준 시도
 */
function markUploadFailedCSS(attempt) {
  if (isNull(attempt) || attempt.done) return;
  clearTimeout(attempt.countdown);
  if (!isNull(attempt.elem)) attempt.elem.className = 'markuploadfailed';
}

/**
 * 업로드 시작 후 20초를 초과한다면 실패로 간주합니다. (앞 업로드 뒤에서 줄을 기다린 시간은 포함하지 않는다)
 * 단일 업로드는 GitHub API 왕복이 7회이고 캐시가 없으면 원격 파일 조회까지 더해져, 10초로는 느린 네트워크에서
 * 실제로 성공한 업로드도 실패로 표시됐다(프로그래머스와 같은 기준). 워치독은 시도마다 따로 둔다.
 * @param {{elem: HTMLElement, done: boolean, countdown: (number|null)}} attempt
 */
function startUploadCountDown(attempt) {
  clearTimeout(attempt.countdown);
  attempt.countdown = setTimeout(() => {
    if (!attempt.done) {
      markUploadFailedCSS(attempt);
    }
  }, 20000);
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
