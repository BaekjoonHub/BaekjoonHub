// Parse all BOJ Data
function findData() {
  // language, submisssionId, problemId, memory, runtime
  findFromResultTable();
  // problemDescription
  findWithPromise();

  console.log(bojData);
}

function findUsername() {
  return document.querySelector('a.username').innerText;
}

function isExistResultTable() {
  return document.getElementById('status-table') !== null;
}

/* Returns the value rows in the table. */
function findResultTableList() {
  const table = document.getElementById('status-table');
  if (table === null || table === undefined || table.length === 0) return [];
  const headers = Array.from(table.rows[0].cells, (x) => convertResultTableHeader(x.innerText.trim()));

  const list = [];
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    const cells = Array.from(row.cells, (x, index) => {
      switch (headers[index]) {
        case 'language':
          return x.innerText.unescapeHtml().replace(/\/.*$/g, '').trim();
        case 'submissionTime':
          return x.firstChild.getAttribute('data-original-title');
        default:
          return x.innerText.trim();
      }
    });
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cells[j];
    }
    list.push(obj);
  }
  if (debug) console.log('TableList', list);
  return list;
}

function findFromResultTable() {
  if (isExistResultTable()) {
    const resultList = findResultTableList();
    if (resultList.length === 0) return;
    const row = resultList[0];
    if (row.username !== findUsername()) {
      if (debug) console.log('Username does not match', row.username, findUsername());
      return;
    }
    bojData.submission.memory = row.memory;
    bojData.submission.runtime = row.runtime;
    bojData.submission.submissionId = row.submissionId;
    bojData.meta.language = row.language;
    bojData.meta.problemId = row.problemId;
  } else if (debug) console.log('Result table not found');
}

function findWithPromise() {
  if (debug) console.log('in find with promise');
  if (checkElem(bojData.meta.problemId) && checkElem(bojData.submission.submissionId)) {
    const DescriptionParse = fetch(`https://www.acmicpc.net/problem/${bojData.meta.problemId}`, { method: 'GET' });
    const CodeParse = fetch(`https://www.acmicpc.net/source/download/${bojData.submission.submissionId}`, { method: 'GET' });
    const SolvedAPI = fetch(`https://solved.ac/api/v3/problem/show?problemId=${bojData.meta.problemId}`, { method: 'GET' });
    Promise.all([DescriptionParse, CodeParse, SolvedAPI])
      .then(([despResponse, codeResponse, solvedResponse]) => Promise.all([despResponse.text(), codeResponse.text(), solvedResponse.json()]))
      .then(([descriptionText, codeText, solvedJson]) => {
        /* Get Question Description */
        let questionDescription = '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(descriptionText, 'text/html');
        if (doc != null) {
          // eslint-disable-next-line prettier/prettier
          questionDescription = `### 문제 설명\n\n${unescapeHtml(doc.getElementById('problem_description').innerHTML.trim())}\n\n`
                              + `### 입력 \n\n ${unescapeHtml(doc.getElementById('problem_input').innerHTML.trim())}\n\n`
                              + `### 출력 \n\n ${unescapeHtml(doc.getElementById('problem_output').innerHTML.trim())}\n\n`;
        }
        bojData.meta.problemDescription = questionDescription;
        if (debug) console.log('findWithPromise - description', questionDescription);
        /* Get Code */
        bojData.submission.code = codeText;
        if (debug) console.log('findWithPromise - code', codeText);
        /* Get Solved Response */
        bojData.meta.title = solvedJson.titleKo;
        bojData.meta.level = bj_level[solvedJson.level];
        bojData.meta.directory = `백준/${bojData.meta.level.replace(/ .*/, '')}/${bojData.meta.problemId}.${bojData.meta.title.replace(/\s+/g, '-').replace(titleRegex, '')}`;
        bojData.meta.message = `[${bojData.meta.level}] Title: ${bojData.meta.title}, Time: ${bojData.submission.runtime} ms, Memory: ${bojData.submission.memory} KB -BaekjoonHub`;
        let str = '';
        solvedJson.tags.forEach((tag) => (str += `${categories[tag.key]}(${tag.key}), `));
        if (debug) console.log(str.length);
        const { length } = str;
        bojData.meta.category = str.substring(0, length - 2);
        if (debug) console.log('findWithPromise - leveldoc', solvedJson);
        /* Create Readme */
        bojData.meta.fileName = bojData.meta.title.replace(/\s+/g, '-').replace(titleRegex, '') + languages[bojData.meta.language];
        // eslint-disable-next-line prettier/prettier
        bojData.meta.readme = `# [${bojData.meta.level}] ${bojData.meta.title} - ${bojData.meta.problemId} \n\n` 
                            + `[문제 링크](https://www.acmicpc.net/problem/${bojData.meta.problemId}) \n\n`
                            + `### 성능 요약\n\n`
                            + `메모리: ${bojData.submission.memory} KB, `
                            + `시간: ${bojData.submission.runtime} ms\n\n`
                            + `### 분류\n\n`
                            + `${bojData.meta.category}\n\n`
                            + `${bojData.meta.problemDescription}\n\n`;

        if (debug) console.log('findData', bojData);
        beginUpload();
      })
      .catch((err) => {
        console.log('error ocurred: ', err);
        uploadState.uploading = false;
        markUploadFailed();
      });
  }
}

/* Since we dont yet have callbacks/promises that helps to find out if things went bad */
/* we will start 10 seconds counter and even after that upload is not complete, then we conclude its failed */
function startUploadCountDown() {
  uploadState.uploading = true;
  uploadState.countdown = setTimeout(() => {
    if (uploadState.uploading === true) {
      // still uploading, then it failed
      uploadState.uploading = false;
      markUploadFailed();
    }
  }, 10000);
}
