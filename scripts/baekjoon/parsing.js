/*
  문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
  모든 해당 파일의 모든 함수는 findData()를 통해 호출됩니다.
*/

/*
  bojData를 초기화하는 함수로 문제 요약과 코드를 파싱합니다.

  - 문제 설명: problemDescription
  - Github repo에 저장될 디렉토리: directory
  - 커밋 메시지: message 
  - 백준 문제 카테고리: category
  - 파일명: fileName
  - Readme 내용 : readme
*/
async function findData(data) {
  try {
    if (isNull(data)) data = findFromResultTable();
    const { 
      title, 
      level, 
      code, 
      problemDescription, 
      directory, 
      message, 
      category, 
      fileName, 
      readme 
    } = await makeDetailMessageAndReadme(data.problemId, data.submissionId, data.language, data.memory, data.runtime);
    return {
      meta: {
        title,
        problemId: data.problemId,
        level,
        problemDescription,
        language: data.language,
        message,
        fileName,
        category,
        readme,
        directory,
      },
      submission: {
        submissionId: data.submissionId,
        code,
        memory: data.memory,
        runtime: data.runtime,
      },
    };
  } catch (error) {
    console.error(error);
  }
  return null;
}

async function makeDetailMessageAndReadme(problemId, submissionId, language, memory, runtime) {
  const {
    title, 
    level, 
    code,
    tags,
    problem_description, 
    problem_input, 
    problem_output 
  } = await findProblemDetailsAndSubmissionCode(problemId, submissionId);

  const problemDescription = `### 문제 설명\n\n${problem_description}\n\n`
                          + `### 입력 \n\n ${problem_input}\n\n`
                          + `### 출력 \n\n ${problem_output}\n\n`;
  const directory = `백준/${level.replace(/ .*/, '')}/${problemId}.${convertSingleCharToDoubleChar(title)}`;
  const message = `[${level}] Title: ${title}, Time: ${runtime} ms, Memory: ${memory} KB -BaekjoonHub`;
  const tagl = [];
  tags.forEach((tag) => tagl.push(`${categories[tag.key]}(${tag.key})`));
  const category = tagl.join(', ');
  const fileName = convertSingleCharToDoubleChar(title) + languages[language];
  const readme = `# [${level}] ${title} - ${problemId} \n\n` 
              + `[문제 링크](https://www.acmicpc.net/problem/${problemId}) \n\n`
              + `### 성능 요약\n\n`
              + `메모리: ${memory} KB, `
              + `시간: ${runtime} ms\n\n`
              + `### 분류\n\n`
              + `${category}\n\n`
              + `${problemDescription}\n\n`;
  return {
    problemId,
    submissionId,
    title,
    level,
    code,
    problemDescription,
    directory,
    message,
    category,
    fileName,
    readme,
  };
}


/*
  현재 로그인된 유저를 파싱합니다.
*/
function findUsername() {
  const el = document.querySelector('a.username');
  if (isNull(el)) return null;
  return el.innerText;
}

/*
  결과 테이블의 존재 여부를 확인합니다.
*/
function isExistResultTable() {
  return document.getElementById('status-table') !== null;
}

/*
  결과 테이블을 파싱하는 함수입니다.
*/
function parsingResultTableList(doc) {
  const table = doc.getElementById('status-table');
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
    obj.element = row;
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cells[j];
    }
    list.push(obj);
  }
  if (debug) console.log('TableList', list);
  return list;
}

/*
  제출 화면의 데이터를 파싱하는 함수로 다음 데이터를 확인합니다.
    - 유저이름: username
    - 실행결과: result
    - 메모리: memory
    - 실행시간: runtime
    - 제출언어: language
    - 제출시간: submissionTime
    - 제출번호: submissionId
    - 문제번호: problemId
    - 해당html요소 : element
*/
function findFromResultTable() {
  if (!isExistResultTable()) {
    if (debug) console.log('Result table not found');
  }
  const resultList = parsingResultTableList(document);
  if (resultList.length === 0) return;
  const row = resultList[0];
  return row;
}

/*
  Fetch를 사용하여 정보를 구하는 함수로 다음 정보를 확인합니다.

    - 문제 설명: problem_description
    - 문제 입력값: problem_input
    - 문제 출력값: problem_output
    - 제출 코드: code
    - 문제 제목: title
    - 문제 등급: level 
    - Github repo에 저장될 디렉토리: directory
    - 커밋 메시지: message 
    - 백준 문제 카테고리: category
*/

async function findProblemDetailsAndSubmissionCode(problemId, submissionId) {
  if (debug) console.log('in find with promise');
  if (isElementExists(problemId) && isElementExists(submissionId)) {
    const DescriptionParse = fetch(`https://www.acmicpc.net/problem/${problemId}`, { method: 'GET' });
    const CodeParse = fetch(`https://www.acmicpc.net/source/download/${submissionId}`, { method: 'GET' });
    const SolvedAPI = fetch(`https://solved.ac/api/v3/problem/show?problemId=${problemId}`, { method: 'GET' });
    return Promise.all([DescriptionParse, CodeParse, SolvedAPI])
      .then(([despResponse, codeResponse, solvedResponse]) => Promise.all([despResponse.text(), codeResponse.text(), solvedResponse.json()]))
      .then(([descriptionText, codeText, solvedJson]) => {
        /* Get Question Description */
        const parser = new DOMParser();
        const doc = parser.parseFromString(descriptionText, 'text/html');
        const problem_description = `${unescapeHtml(doc.getElementById('problem_description').innerHTML.trim())}`;
        const problem_input       = `${unescapeHtml(doc.getElementById('problem_input').innerHTML.trim())}`;
        const problem_output      = `${unescapeHtml(doc.getElementById('problem_output').innerHTML.trim())}`;
        /* Get Code */
        const code = codeText;
        if (debug) console.log('findProblemDetailsAndSubmissionCode - code', code);
        /* Get Solved Response */
        const { tags } = solvedJson;
        const title = solvedJson.titleKo;
        const level = bj_level[solvedJson.level];
        return { problemId, submissionId, title, level, tags, code, problem_description, problem_input, problem_output };
      });
    // .catch((err) => {
    //   console.log('error ocurred: ', err);
    //   uploadState.uploading = false;
    //   markUploadFailedCSS();
    // });
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
      markUploadFailedCSS();
    }
  }, 10000);
}

/**
 * user가 푼 백준의 문제번호 리스트를 가져오는 함수
 * @param username: 백준 아이디
 * @return Promise<Array<String>>
 */
async function findSolvedProblemsList(username) {
  return fetch(`https://www.acmicpc.net/user/${username}`, { method: 'GET' })
    .then((html) => html.getElementsByClassName('result-ac'))
    .then((collections) => Array.from(collections))
    .then((arr) => arr.map((name) => name.textContent));
}

/**
 * user가 problemId 에 제출한 리스트를 가져오는 함수
 * @param problemId: 문제 번호
 * @param username: 백준 아이디
 * @return Promise<Array<String>>
 */
async function findResultTableByProblemIdAndUsername(problemId, username) {
  return fetch(`https://www.acmicpc.net/status?from_mine=1&problem_id=${problemId}&user_id=${username}`, { method: 'GET' })
    .then((html) => html.text())
    .then((text) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return parsingResultTableList(doc);
    });
}

/**
 * user가 "맞았습니다!!" 결과를 맞은 중복되지 않은 제출 결과 리스트를 가져오는 함수
 * @param username: 백준 아이디
 * @returns Promise<Array<Object>>
 */
async function findUniqueResultTableListByUsername(username) {
  return unique(await findResultTableListByUsername(username), 'problemId');
}

/**
 * user가 "맞았습니다!!" 결과를 맞은 모든 제출 결과 리스트를 가져오는 함수
 * @param username: 백준 아이디
 * @return Promise<Array<Object>>
 */
async function findResultTableListByUsername(username) {
  const rsult = [];
  let doc = await findHtmlDocumentByUrl(`https://www.acmicpc.net/status?user_id=${username}&result_id=4`);
  let next_page = doc.getElementById('next_page');
  do {
    rsult.push(...parsingResultTableList(doc));
    doc = await findHtmlDocumentByUrl(next_page.getAttribute('href'));
  } while ((next_page = doc.getElementById('next_page')) !== null);
  rsult.push(...parsingResultTableList(doc));

  return rsult;
}

/**
 * url에 해당하는 html 문서를 가져오는 함수
 * @param url: url 주소
 * @returns html document
 */
async function findHtmlDocumentByUrl(url) {
  return fetch(url, { method: 'GET' })
    .then((html) => html.text())
    .then((text) => {
      const parser = new DOMParser();
      return parser.parseFromString(text, 'text/html');
    });
}
