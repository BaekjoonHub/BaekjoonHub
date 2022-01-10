// Upload icon - Set Loading Icon
/* start upload will inject a spinner on left side to the "Run Code" button */
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

// Upload icon - Set Completed Icon
/* This will create a tick mark before "Run Code" button signalling BaekjoonHub has done its job */
function markUploadedCSS() {
  uploadState.uploading = false;
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  elem.className = 'markuploaded';
}

// Upload icon - Set Failed Icon
/* This will create a failed tick mark before "Run Code" button signalling that upload failed */
function markUploadFailedCSS() {
  uploadState.uploading = false;
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  elem.className = 'markuploadfailed';
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

/**  
  * 파싱된 문제별로 최고 성능의 제출 내역 하나씩을 리턴합니다 
  * @param arr: 파싱된
**/
function unique(arr, key) {
  
  if (key === undefined) return arr.filter((obj, index, self) => self.indexOf(obj) === index);
  const returnList = [];

  // O(N) 비교 함수
  arr.forEach((obj) => {
    let idx = returnList.findIndex((t) => t[key] === obj[key]);
    if(idx < 0) returnList.push(obj);
    else if(betterSubmission(returnList[idx], obj)>0){
      returnList.splice(idx, 1, obj);
    }
  });
  // return arr.filter((obj, index, self) => self.findIndex((t) => t[key] === obj[key]) === index);
  console.log("returnList", returnList);
  return returnList;
}


/**
  * 제출 목록 비교함수입니다
  * comparator로 사용할 수 있도록 1:-1 반환
  * submission1이 났다면 -1, submission2가 났다면 1 리턴
**/
function betterSubmission(submission1, submission2){

  if(+submission1.runtime > +submission2.runtime) return 1;
  if(+submission1.runtime < +submission2.runtime) return -1;

  if(+submission1.memory > +submission2.memory) return 1;
  if(+submission1.memory < +submission2.memory) return -1;

  if(+submission1.codeLength > +submission2.codeLength) return 1;
  if(+submission1.codeLength < +submission2.codeLength) return -1;

  // 주어진 배열은 시간 순이므로 모든게 동일하다면 먼저 전자 리턴
  return -1;
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
