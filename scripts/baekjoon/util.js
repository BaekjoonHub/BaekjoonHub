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

function getVersion() {
  return chrome.runtime.getManifest().version;
}

/* Util function to check if an element exists */
function elementExists(element) {
  return element !== undefined && element !== null && element.length > 0;
}

function isNull(value) {
  return value === null || value === undefined;
}

/* A function that recursively checks that all values of object are not '' */
function isNotEmpty(obj) {
  if (obj === undefined || obj === null || obj === '' || obj === [] || obj === {}) return false;
  if (typeof obj !== 'object') return true;
  if (obj.length === 0) return false;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (!isNotEmpty(obj[key])) return false;
    }
  }
  return true;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

function unescapeHtml(text) {
  const unescaped = {
    '&amp;': '&',
    '&#38;': '&',
    '&lt;': '<',
    '&#60;': '<',
    '&gt;': '>',
    '&#62;': '>',
    '&apos;': "'",
    '&#39;': "'",
    '&quot;': '"',
    '&#34;': '"',
    '&nbsp;': ' ',
    '&#160;': ' ',
  };
  return text.replace(/&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|nbsp|#160);/g, function (m) {
    return unescaped[m];
  });
}

/* 일반 특수문자를 전각문자로 변환하는 함수 */
function convertSingleCharToDoubleChar(text) {
  // singleChar to doubleChar mapping
  const map = {
    '!': '！',
    '%': '％',
    '&': '＆',
    '(': '（',
    ')': '）',
    '*': '＊',
    '+': '＋',
    ',': '，',
    '-': '－',
    '.': '．',
    '/': '／',
    ':': '：',
    ';': '；',
    '<': '＜',
    '=': '＝',
    '>': '＞',
    '?': '？',
    '@': '＠',
    '[': '［',
    '\\': '＼',
    ']': '］',
    '^': '＾',
    '_': '＿',
    '`': '｀',
    '{': '｛',
    '|': '｜',
    '}': '｝',
    '~': '～',
    ' ': ' ', // 공백만 전각문자가 아닌 FOUR-PER-EM SPACE로 변환
  };
  return text.replace(/[!%&()*+,\-./:;<=>?@\[\\\]^_`{|}~ ]/g, function (m) {
    return map[m];
  });
}

String.prototype.escapeHtml = function () {
  return escapeHtml(this);
};

String.prototype.unescapeHtml = function () {
  return unescapeHtml(this);
};

function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(`0x${p1}`);
    }),
  );
}

function b64DecodeUnicode(b64str) {
  return decodeURIComponent(
    atob(b64str)
      .split('')
      .map(function (c) {
        return `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`;
      })
      .join(''),
  );
}
/** key 값을 기준으로 array를 그룹핑하여 map으로 반환합니다.
 * @param {object} array - array to be sorted
 * @param {string} key - key to sort
 * @returns {object} - key 기준으로 그룹핑된 객체들 배열을 value로 갖는 map
 */
function groupBy(array, key) {
  return array.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
}

/**
 * arr에서 같은 key 그룹 내의 요소 중 최고의 값을 리스트화하여 반환합니다.
 * @param arr: 비교할 요소가 있는 배열
 * @param key: 같은 그룹으로 묶을 키 값
 * @param compare: 비교할 함수
 * @returns {array<object>} : 같은 key 그룹 내의 요소 중 최고의 값을 반환합니다.
 * */
function maxValuesGroupBykey(arr, key, compare) {
  const map = groupBy(arr, key);
  const result = [];
  for (const [key, value] of Object.entries(map)) {
    const maxValue = value.reduce((max, current) => {
      return compare(max, current) > 0 ? max : current;
    });
    result.push(maxValue);
  }
  return result;
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

function updateStatsPostUpload(bojData, sha, type, cb = undefined){

  console.log('in updateStatsPostUpload', bojData, sha, type);

  getStats().then((stats)=>{
    
    if (stats === null || stats === {} || stats === undefined) {
      // create stats object
      stats = {};
      stats.version = '1.0.2';
      stats.submission = {};
    }

    const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
    const { submissionId } = bojData.submission;

    if (isNull(stats.submission[filePath])) {
      stats.submission[filePath] = {};
    }

    stats.submission[filePath].submissionId = submissionId;
    stats.submission[filePath][type] = sha; // update sha key.
    saveStats(stats).then(() => {
      if (debug) console.log(`Successfully committed ${bojData.meta.fileName} to github`);
      if (cb !== undefined) cb();
    });
  })
}
