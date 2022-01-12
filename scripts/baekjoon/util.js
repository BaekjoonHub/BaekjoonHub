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
  const target = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[3];
  if (target.childNodes.length > 0) {
    target.childNodes[0].append(elem);
  }
  // start the countdown
  startUploadCountDown();
}

/**
 * 업로드 완료 아이콘 표시
 */
function markUploadedCSS() {
  uploadState.uploading = false;
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  elem.className = 'markuploaded';
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
 * 제출 목록 비교함수입니다
 * @param {object} a - 제출 요소 피연산자 a
 * @param {object} b - 제출 요소 피연산자 b
 * @returns {number} - a와 b 아래의 우선순위로 값을 비교하여 정수값을 반환합니다.
 * 1. 실행시간(runtime)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 2. 사용메모리(memory)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 3. 코드길이(codeLength)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 4. 위의 요소가 모두 같은 경우 제출한 요소(submissionId)의 그 차이 값의 역을 반환합니다.
 * */
function compareSubmission(a, b) {
  return a.runtime === b.runtime
          ? a.memory === b.memory
            ? a.codeLength === b.codeLength
              ? -(a.submissionId - b.submissionId)
              : a.codeLength - b.codeLength
            : a.memory - b.memory
          : a.runtime - b.runtime
  ;
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

function convertResultTableHeader(header) {
  switch (header) {
    case '문제번호':
    case '문제':
      return 'problemId';
    case '난이도':
      return 'level';
    case '결과':
      return 'result';
    case '문제내용':
      return 'problemDescription';
    case '언어':
      return 'language';
    case '제출 번호':
      return 'submissionId';
    case '아이디':
      return 'username';
    case '제출시간':
    case '제출한 시간':
      return 'submissionTime';
    case '시간':
      return 'runtime';
    case '메모리':
      return 'memory';
    case '코드 길이':
      return 'codeLength';
    default:
      return 'unknown';
  }
}

/** github에 업로드한 파일의 sha 정보를 업데이트 합니다.
 * @param {object} bojData - 문제 정보
 * @param {string} sha - 업로드 파일 sha 정보
 * @param {enum<CommitType>} type - 업로드 파일의 타입
 * @param {function} cb - 저장을 완료한 후 호출할 콜백함수
 * @returns {void}
 */
function updateStatsPostUpload(bojData, sha, type, cb) {
  getStats().then((stats) => {
    if (isEmpty(stats)) {
      stats = { version: getVersion(), submissions: {} };
    }

    const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;

    if (isNull(stats.submission[filePath])) {
      stats.submission[filePath] = {};
    }

    stats.submission[filePath] = { ...stats.submission[filePath], ...{ submissionId: bojData.submission.submissionId, [type]: sha } };
    saveStats(stats).then(() => {
      if (debug) console.log(`Successfully committed ${bojData.meta.fileName} to github`);
      if (typeof cb === 'function') cb();
    });
  });
}

function insertUploadAllButton() {
  const profileNav = document.getElementsByClassName('nav-tabs')[0];
  if (debug) console.log('profileNav', profileNav);
  const uploadButton = document.createElement('li');
  uploadButton.innerHTML = '<a class="BJH_button" style="display:inline-table;">백준허브 업데이트</a>';
  profileNav.append(uploadButton);
  uploadButton.onclick = () => {
    if (confirm('현재까지 해결한 모든 문제가 업로드됩니다.\n실행 전에 사용 설명서를 참고하시는 것을 추천드립니다.\n\n진행하시겠습니까?')) {
      uploadButton.append(insertMultiLoader());
      uploadAllSolvedProblem();
    }
  };
}

function insertMultiLoader() {
  multiloader.wrap = document.createElement('div');
  multiloader.wrap.classList.add('BJH_loading_wrap');

  multiloader.nom = document.createElement('div');
  multiloader.nom.classList.add('BJH_loading_number');
  multiloader.nom.innerText = -1;

  const hyphen = document.createElement('div');
  hyphen.classList.add('BJH_loading_number');
  hyphen.innerText = '/';

  multiloader.denom = document.createElement('div');
  multiloader.denom.classList.add('BJH_loading_number');
  multiloader.denom.innerText = 'loading';

  multiloader.wrap.append(multiloader.nom);
  multiloader.wrap.append(hyphen);
  multiloader.wrap.append(multiloader.denom);
  return multiloader.wrap;
}

function setMultiLoaderDenom(num) {
  multiloader.denom.innerText = num;
}

function incMultiLoader(num) {
  multiloader.nom.innerText = +multiloader.nom.innerText + num;
}
