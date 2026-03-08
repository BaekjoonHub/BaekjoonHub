/**
 * 로딩 버튼 추가
 */
function startUpload() {
  let elem = document.getElementById('BaekjoonHub_progress_anchor_element');
  if (elem !== undefined) {
    elem = document.createElement('span');
    elem.id = 'BaekjoonHub_progress_anchor_element';
    // elem.className = 'runcode-wrapper__8rXm';
    // elem.style = 'margin-left: 10px;padding-top: 0px;';
  }
  elem.innerHTML = `<div id="BaekjoonHub_progress_elem" class="BaekjoonHub_progress"></div>`;
  const target = document.querySelector('div.box-list > div.box-list-inner > div.right_answer > span.btn_right');
  if (!isNull(target)) {
    target.prepend(elem);
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
 * 로그인한 유저의 닉네임을 가져옵니다.
 * @returns {string} 유저 닉네임이며 없을 시에 null을 반환
 */
function getNickname() {
  return document.querySelector('#Beginner')?.innerText || document.querySelector('header > div > span.name')?.innerText || '';
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
 * 유저 코드 목록 페이지에 "전체제출 업로드" 버튼을 삽입합니다.
 */
function insertUploadAllButton() {
  const header = document.querySelector('h4.club_box_tit');
  if (isNull(header)) return;
  const btn = document.createElement('button');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:3px;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" fill="currentColor"/></svg>전체제출 업로드';
  btn.className = 'BJH_uploadall_btn';
  btn.style.cssText = 'cursor:pointer;margin-left:10px;padding:2px 8px;background:transparent;color:#2e2e2e;border:1px solid #ccc;border-radius:3px;font-size:13px;font-weight:400;vertical-align:middle;line-height:22px;';
  btn.addEventListener('click', () => {
    if (confirm('GitHub에 전체 제출을 업로드하시겠습니까?')) {
      insertMultiLoader();
      uploadAllSolvedProblemSWEA();
    }
  });
  header.appendChild(btn);
}

/**
 * 전체 업로드 진행률 표시 DOM을 생성합니다.
 */
function insertMultiLoader() {
  const btn = document.querySelector('.BJH_uploadall_btn');
  const parent = btn ? btn.parentElement : document.body;
  const wrap = document.createElement('span');
  wrap.className = 'BJH_loading_wrap';
  wrap.style.cssText = 'margin-left:10px;font-size:13px;vertical-align:middle;';
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
