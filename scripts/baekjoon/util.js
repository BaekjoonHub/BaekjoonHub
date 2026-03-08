/**
 * 로딩 버튼 추가
 */
function startUpload() {
  let elem = document.getElementById('BaekjoonHub_progress_anchor_element');
  if (elem !== undefined) {
    elem = document.createElement('span');
    elem.id = 'BaekjoonHub_progress_anchor_element';
    elem.className = 'runcode-wrapper__8rXm';
    elem.style = 'margin-left: 10px;padding-top: 0px;';
  }
  elem.innerHTML = `<div id="BaekjoonHub_progress_elem" class="BaekjoonHub_progress"></div>`;
  const target = document.getElementById('status-table')?.childNodes[1].childNodes[0].childNodes[3] || document.querySelector('div.table-responsive > table > tbody > tr > td:nth-child(5)');
  target.append(elem);
  if (target.childNodes.length > 0) {
    target.childNodes[0].append(elem);
  }
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
  if (!elem) return;
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
  if (!elem) return;
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
 * 제출 목록 비교함수입니다
 * @param {object} a - 제출 요소 피연산자 a
 * @param {object} b - 제출 요소 피연산자 b
 * @returns {number} - a와 b 아래의 우선순위로 값을 비교하여 정수값을 반환합니다.
 * 1. 서브태스크가 있는 문제이고, 점수(result)의 차이가 있을 경우 a > b 이면 음수, a < b 이면 양수를 반환합니다.
 * 2. 실행시간(runtime)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 3. 사용메모리(memory)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 4. 코드길이(codeLength)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 5. 위의 요소가 모두 같은 경우 제출한 요소(submissionId)의 그 차이 값의 역을 반환합니다.
 * */
function compareSubmission(a, b) {
  // prettier-ignore-start
  /* eslint-disable */
  return hasNotSubtask(a.result, b.result)
          ? a.runtime === b.runtime
            ? a.memory === b.memory
              ? a.codeLength === b.codeLength
                ? -(a.submissionId - b.submissionId)
                : a.codeLength - b.codeLength
              : a.memory - b.memory
            : a.runtime - b.runtime
          : compareResult(a.result, b.result)
  ;
  /* eslint-enable */
  // prettier-ignore-end
}

/**
 * 서브태스크가 있는 문제의 경우도 고려해 제출 결과를 비교하는 함수입니다.
 * @param {string} a 제출 결과 피연산자 a
 * @param {string} b 제출 결과 피연산자 b
 * @returns {boolean} 서브 태스크가 없는 경우 true, 서브 태스크가 있는 경우 false를 반환합니다.
 */
function hasNotSubtask(a, b) {
  a = parseNumberFromString(a);
  b = parseNumberFromString(b);

  if (isNaN(a) && isNaN(b)) return true;

  return false;
}

/**
 * 서브태스크가 있는 문제의 경우 점수가 높은 순서로 정렬되도록 값을 반환합니다.
 * @param {string} a 제출 결과 피연산자 a
 * @param {string} b 제출 결과 피연산자 b
 * @returns {number} a의 점수가 높은 경우 음수, b의 점수가 높은 경우 양수
 */
function compareResult(a, b) {
  a = parseNumberFromString(a);
  b = parseNumberFromString(b);

  if (typeof a === 'number' && typeof b === 'number') return -(a - b);
  if (isNaN(b)) return -1;
  if (isNaN(a)) return 1;
}

/**
 * 파싱된 문제별로 최고의 성능의 제출 내역을 하나씩 뽑아서 배열로 반환합니다.
 * @param {array} submissions - 제출 목록 배열
 * @returns {array} - 목록 중 문제별로 최고의 성능 제출 내역을 담은 배열
 */
function selectBestSubmissionList(submissions) {
  if (isNull(submissions) || submissions.length === 0) return [];
  return maxValuesGroupBykey(submissions, 'problemId', (a, b) => -compareSubmission(a, b));
}

/**
 * 프로필 페이지의 nav-tabs에 "전체제출 업로드" 버튼을 삽입합니다.
 */
function insertUploadAllButton() {
  const navTabs = document.querySelector('ul.nav.nav-tabs');
  if (isNull(navTabs)) return;
  const li = document.createElement('li');
  const btn = document.createElement('a');
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:4px;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" fill="currentColor"/></svg>전체제출 업로드';
  btn.style.cursor = 'pointer';
  btn.addEventListener('click', () => {
    if (confirm('GitHub에 전체 제출을 업로드하시겠습니까?')) {
      insertMultiLoader();
      uploadAllSolvedProblem();
    }
  });
  li.appendChild(btn);
  navTabs.appendChild(li);
}

/**
 * 전체 업로드 진행률 표시 DOM을 생성합니다.
 */
function insertMultiLoader() {
  const navTabs = document.querySelector('ul.nav.nav-tabs');
  if (isNull(navTabs)) return;
  const wrap = document.createElement('li');
  wrap.className = 'BJH_loading_wrap';
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
  navTabs.appendChild(wrap);
  multiloader.wrap = wrap;
  multiloader.nom = nom;
  multiloader.denom = denom;
}

/**
 * 전체 업로드 전체 개수를 설정합니다.
 */
function setMultiLoaderDenom(num) {
  if (!isNull(multiloader.denom)) {
    multiloader.denom.textContent = String(num);
  }
}

/**
 * 전체 업로드 완료 개수를 증가시킵니다.
 */
function incMultiLoader(num) {
  if (!isNull(multiloader.nom)) {
    multiloader.nom.textContent = String(Number(multiloader.nom.textContent) + num);
  }
}

/**
 * 전체 업로드가 이미 최신 상태임을 표시합니다.
 */
function MultiloaderUpToDate() {
  if (!isNull(multiloader.wrap)) {
    multiloader.wrap.textContent = 'Up To Date';
  }
}

/**
 * 전체 업로드 성공을 표시합니다.
 */
function MultiloaderSuccess() {
  if (!isNull(multiloader.wrap)) {
    multiloader.wrap.textContent = 'SUCCESS';
    setTimeout(() => location.reload(), 3000);
  }
}

function convertResultTableHeader(header) {
  switch (header) {
    case '문제번호':
    case '문제':
    case 'Problem':
      return 'problemId';
    case '난이도':
      return 'level';
    case '결과':
    case 'Result':
      return 'result';
    case '문제내용':
      return 'problemDescription';
    case '언어':
    case 'Language':
      return 'language';
    case '제출 번호':
    case 'Submission #':
      return 'submissionId';
    case '아이디':
    case 'User':
      return 'username';
    case '제출시간':
    case '제출한 시간':
    case 'Submitted':
      return 'submissionTime';
    case '시간':
    case 'Time':
      return 'runtime';
    case '메모리':
    case 'Memory':
      return 'memory';
    case '코드 길이':
    case 'Code Length':
      return 'codeLength';
    default:
      return 'unknown';
  }
}

function convertImageTagAbsoluteURL(doc = document) {
  if(isNull(doc)) return;
  // img tag replace Relative URL to Absolute URL.
  Array.from(doc.getElementsByTagName('img'), (x) => {
    x.setAttribute('src', x.currentSrc);
    return x;
  });
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
