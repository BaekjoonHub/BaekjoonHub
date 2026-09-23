/**
 * 결과 모달 footer 에 로딩 아이콘을 넣고, 이번 업로드 시도(attempt)를 반환합니다.
 * 아이콘 갱신은 모두 attempt.elem 을 통해서만 한다. 재제출로 시도가 겹칠 때(앞 업로드가 아직 진행 중인데
 * 다음 정답이 나온 경우) 앞 시도의 완료 콜백이 getElementById 로 새 시도의 아이콘을 찾아 덮어쓰지 않게 하기 위함이다.
 * 워치독은 여기서 켜지 않는다. 앞 업로드 뒤에서 줄을 기다리는 동안은 로딩 아이콘을 유지하고,
 * 이 시도의 업로드가 실제로 시작될 때 enqueueUpload 가 startUploadCountDown 을 호출한다.
 * @returns {{elem: HTMLElement, done: boolean, countdown: (number|null)}}
 */
function startUpload() {
  /* 이전 시도의 아이콘은 떼어낸다. 떼어낸 요소는 이전 attempt 가 계속 붙잡고 있으므로,
     그 시도가 나중에 끝나도 새 모달의 아이콘에는 영향이 없다. */
  const prevAnchor = document.getElementById('BaekjoonHub_progress_anchor_element');
  if (!isNull(prevAnchor)) prevAnchor.remove();
  const anchor = document.createElement('span');
  anchor.id = 'BaekjoonHub_progress_anchor_element';
  anchor.className = 'runcode-wrapper__8rXm';
  anchor.style = 'margin-left: 10px;padding-top: 0px;';
  const elem = document.createElement('div');
  elem.id = 'BaekjoonHub_progress_elem';
  elem.className = 'BaekjoonHub_progress';
  anchor.appendChild(elem);
  const target = document.querySelector('#modal-dialog > div.modal-dialog > div.modal-content > div.modal-footer');
  if (!isNull(target)) {
    target.prepend(anchor);
  }
  return { elem, done: false, countdown: null };
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
  /* 업로드 도중 결과 모달이 닫혀 아이콘이 사라진 경우 크래시를 막는다.
     이 함수는 커밋이 성공한 뒤에 실행되는 콜백이므로, 여기서 TypeError가 나면
     이미 성공한 커밋이 실패한 것처럼 보이게 된다. */
  if (isNull(elem)) return;
  elem.className = 'markuploaded';
  const uploadedUrl = "https://github.com/" +
              Object.keys(branches)[0] + "/tree/" +
              branches[Object.keys(branches)[0]] + "/" + directory;
  elem.addEventListener("click", function() {
    window.location.href = uploadedUrl;
  });
  elem.style.cursor = "pointer";
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
 * (느린 네트워크에서 업로드가 실제로는 성공하는데 실패 아이콘이 표시되던 오탐을 줄이기 위해 10초 -> 20초.
 *  프로그래머스 단일 업로드는 GitHub API 왕복이 7회이고, 캐시가 없으면 저장소 전체 tree 조회까지 더해진다.)
 * 워치독은 시도마다 따로 둔다. 한 시도의 워치독이 다른 시도의 아이콘을 실패로 덮어쓰지 않는다.
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

function getDateString(date){
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}:${seconds}`;
}

/**
 * 풀이 목록 페이지에 "전체제출 업로드" 버튼을 삽입합니다.
 * "즐겨찾기한 문제" 버튼 옆에 동일한 스타일(div.bookmark)로 백준허브 아이콘과 함께 삽입합니다.
 */
function insertUploadAllButton() {
  const bookmarkBtn = document.querySelector('div.total div.bookmark');
  if (isNull(bookmarkBtn)) return;
  const btn = document.createElement('div');
  btn.className = 'bookmark BJH_uploadall_btn';
  btn.style.marginLeft = '6px';
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" fill="currentColor"/></svg><span>전체제출 업로드</span>`;
  btn.addEventListener('click', () => {
    if (confirm('GitHub에 전체 제출을 업로드하시겠습니까?')) {
      insertMultiLoader();
      uploadAllSolvedProblemProgrammers();
    }
  });
  bookmarkBtn.after(btn);
}

/**
 * 전체 업로드 진행률 표시 DOM을 생성합니다.
 */
function insertMultiLoader() {
  const btn = document.querySelector('.BJH_uploadall_btn');
  const parent = btn ? btn.parentElement : document.body;
  const wrap = document.createElement('div');
  wrap.className = 'bookmark BJH_loading_wrap';
  const nom = document.createElement('span');
  nom.className = 'BJH_loading_number';
  nom.textContent = '0';
  const slash = document.createTextNode(' / ');
  const denom = document.createElement('span');
  denom.className = 'BJH_loading_number';
  denom.textContent = '0';
  wrap.appendChild(nom);
  wrap.appendChild(slash);
  wrap.appendChild(denom);
  if (btn) btn.after(wrap);
  else parent.appendChild(wrap);
  multiloader.wrap = wrap;
  multiloader.nom = nom;
  multiloader.denom = denom;
}

function setMultiLoaderDenom(num) {
  if (!isNull(multiloader.denom)) {
    multiloader.denom.textContent = String(num);
  }
}

function incMultiLoader(num) {
  if (!isNull(multiloader.nom)) {
    multiloader.nom.textContent = String(Number(multiloader.nom.textContent) + num);
  }
}

function MultiloaderUpToDate() {
  if (!isNull(multiloader.wrap)) {
    multiloader.wrap.textContent = 'Up To Date';
  }
}

function MultiloaderSuccess() {
  if (!isNull(multiloader.wrap)) {
    multiloader.wrap.textContent = 'SUCCESS';
    setTimeout(() => location.reload(), 3000);
  }
}
