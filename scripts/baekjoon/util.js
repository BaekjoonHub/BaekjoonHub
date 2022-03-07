/**
 * 로딩 버튼 추가
 */
function startUpload() {
  // let elem = document.getElementById('BaekjoonHub_progress_anchor_element');
  // if (elem !== undefined) {
  //   elem = document.createElement('span');
  //   elem.id = 'BaekjoonHub_progress_anchor_element';
  //   elem.className = 'runcode-wrapper__8rXm';
  //   elem.style = 'margin-left: 10px;padding-top: 0px;';
  // }
  // elem.innerHTML = `<div id="BaekjoonHub_progress_elem" class="BaekjoonHub_progress"></div>`;
  // const target = document.querySelector('div.table-responsive > table > tbody > tr > td:nth-child(5)');
  // target.append(elem);
  // const target = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[3];
  // if (target.childNodes.length > 0) {
  //   target.childNodes[0].append(elem);
  // }
  // Swal.fire({
  //   title: '🛠️ 업로드 진행중',
  //   html: '<b>BaekjoonHub</b> 익스텐션이 실행하였습니다<br/>이 창은 자동으로 닫힙니다',
  //   didOpen: () => {
  //     Swal.showLoading();
  //   },
  //   allowOutsideClick: false,
  //   allowEscapeKey: false,
  //   allowEnterKey: false,
  // });
  // start the countdown
  startUploadCountDown();
}

/**
 * 업로드 완료 아이콘 표시
 */
function markUploadedCSS() {
  uploadState.uploading = false;
  // const elem = document.getElementById('BaekjoonHub_progress_elem');
  // elem.className = 'markuploaded';
  Swal.fire({
    title: '작업 완료',
    icon: 'success',
    html: '<b>BaekjoonHub</b> 익스텐션이 실행하였습니다<br/>이 창은 자동으로 닫힙니다',
  });
  // 1초후 창 닫기
  setTimeout(() => {
    window.close();
  }, 1000);
}

/**
 * 업로드 실패 아이콘 표시
 */
function markUploadFailedCSS() {
  uploadState.uploading = false;
  // const elem = document.getElementById('BaekjoonHub_progress_elem');
  // elem.className = 'markuploadfailed';
  Swal.fire({
    icon: 'error',
    title: '업로드 실패',
    text: '업로드에 실패하였습니다.',
    footer: '<a href="https://github.com/BaekjoonHub/BaekjoonHub/issues">개발자에게 문의하기</a>',
  });
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
  // prettier-ignore-start
  /* eslint-disable */
  return a.runtime === b.runtime
          ? a.memory === b.memory
            ? a.codeLength === b.codeLength
              ? -(a.submissionId - b.submissionId)
              : a.codeLength - b.codeLength
            : a.memory - b.memory
          : a.runtime - b.runtime
  ;
  /* eslint-enable */
  // prettier-ignore-end
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

function insertUploadAllButton() {
  const profileNav = document.getElementsByClassName('nav-tabs')[0];
  if (debug) console.log('profileNav', profileNav);
  const uploadButton = document.createElement('li');
  uploadButton.innerHTML = '<a class="BJH_button" style="display:inline-table;">전체제출 업로드</a>';
  profileNav.append(uploadButton);
  uploadButton.onclick = () => {
    if (confirm('현재까지 해결한 모든 문제가 업로드됩니다.\n실행 전에 사용 설명서를 참고하시는 것을 추천드립니다.\n\n진행하시겠습니까?')) {
      uploadButton.append(insertMultiLoader());
      uploadAllSolvedProblem();
    }
  };
}

function insertDownloadAllButton() {
  // 2500 솔 이하일 때 표시하지 않음
  if (+document.getElementById('u-solved').innerText <= 2500) return;

  const profileNav = document.getElementsByClassName('nav-tabs')[0];
  if (debug) console.log('profileNav', profileNav);
  const downloadButton = document.createElement('li');
  downloadButton.innerHTML = '<a class="BJH_button" style="display:inline-table;">전체제출 다운로드</a>';
  profileNav.append(downloadButton);
  downloadButton.onclick = () => {
    if (confirm('현재까지 해결한 모든 문제가 다운로드 됩니다.\n\n진행하시겠습니까?')) {
      downloadButton.append(insertMultiLoader());
      downloadAllSolvedProblem();
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

function MultiloaderUpToDate() {
  multiloader.wrap.innerHTML = 'Up To Date';
}

function convertImageTagAbsoluteURL(doc = document) {
  // img tag replace Relative URL to Absolute URL.
  Array.from(doc.getElementsByTagName('img'), (x) => {
    x.setAttribute('src', x.currentSrc);
    return x;
  });
}
