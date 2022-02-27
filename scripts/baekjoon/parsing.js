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
    if (isNull(data)) {
      let table = filter(findFromResultTable(), 'resultCategory', RESULT_CATEGORY.RESULT_ACCEPTED);
      table = filter(table, 'username', findUsername());
      if (isEmpty(table)) return null;
      data = selectBestSubmissionList(table)[0];
    }
    const details = await makeDetailMessageAndReadme(data.problemId, data.submissionId, data.language, data.memory, data.runtime);
    return details;
  } catch (error) {
    console.error(error);
  }
  return null;
}

async function makeDetailMessageAndReadme(problemId, submissionId, language, memory, runtime) {
  // prettier-ignore
  const {
    title, 
    level, 
    code,
    tags,
    problem_description, 
    problem_input, 
    problem_output 
  } = await findProblemDetailsAndSubmissionCode(problemId, submissionId);

  // prettier-ignore
  const problemDescription = `### 문제 설명\n\n${problem_description}\n\n`
                          + `### 입력 \n\n ${problem_input}\n\n`
                          + `### 출력 \n\n ${problem_output}\n\n`;
  const directory = `백준/${level.replace(/ .*/, '')}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;
  const message = `[${level}] Title: ${title}, Time: ${runtime} ms, Memory: ${memory} KB -BaekjoonHub`;
  const tagl = [];
  tags.forEach((tag) => tagl.push(`${categories[tag.key]}(${tag.key})`));
  const category = tagl.join(', ');
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languages[language]}`;
  // prettier-ignore
  const readme = `# [${level}] ${title} - ${problemId} \n\n` 
              + `[문제 링크](https://www.acmicpc.net/problem/${problemId}) \n\n`
              + `### 성능 요약\n\n`
              + `메모리: ${memory} KB, `
              + `시간: ${runtime} ms\n\n`
              + `### 분류\n\n`
              + `${category || "Empty"}\n\n`
              + `${problemDescription}\n\n`;
  return {
    // problemId,
    // submissionId,
    // title,
    // level,
    // problemDescription,
    // category,
    directory,
    fileName,
    message,
    code,
    readme,
  };
}

/*
  현재 로그인된 유저를 파싱합니다.
*/
function findUsername() {
  const el = document.querySelector('a.username');
  if (isNull(el)) return null;
  const username = el.innerText;
  if (isEmpty(username)) return null;
  return username;
}

/*
  유저 정보 페이지에서 유저 이름을 파싱합니다.
*/
function findUsernameOnUserInfoPage() {
  const el = document.querySelector('div.page-header > h1');
  if (isNull(el)) return null;
  const username = el.textContent.trim();
  if (isEmpty(username)) return null;
  return username;
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
        case 'result':
          return { result: x.innerText.trim(), resultCategory: x.firstChild.getAttribute('data-color').replace('-eng', '').trim() };
        case 'language':
          return x.innerText.unescapeHtml().replace(/\/.*$/g, '').trim();
        case 'submissionTime':
          const el = x.querySelector('a.show-date');
          if (isNull(el)) return null;
          return el.getAttribute('data-original-title');
        case 'problemId':
          const el2 = x.querySelector('a.problem_title');
          if (isNull(el2)) return null;
          return el2.getAttribute('href').replace(/^.*\/([0-9]+)$/, '$1');
        default:
          return x.innerText.trim();
      }
    });
    let obj = {};
    obj.elementId = row.id;
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cells[j];
    }
    obj = { ...obj, ...obj.result };
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
  return parsingResultTableList(document);
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

class ReadableObject {
  constructor(text) {
    this.raw = text;
  }

  text() {
    return this.raw;
  }
}

async function findProblemDetailsAndSubmissionCode(problemId, submissionId) {
  if (debug) console.log('in find with promise');
  if (elementExists(problemId) && elementExists(submissionId)) {
    // const DescriptionParse = fetch(`https://www.acmicpc.net/problem/${problemId}`, { method: 'GET' });
    // const CodeParse = fetch(`https://www.acmicpc.net/source/download/${submissionId}`, { method: 'GET' });

    const iframe1 = document.createElement('iframe');
    iframe1.src = `https://www.acmicpc.net/problem/${problemId}`;
    iframe1.style.display = 'none';

    const iframe2 = document.createElement('iframe');
    iframe2.src = `https://www.acmicpc.net/source/${submissionId}`;
    iframe2.style.display = 'none';

    document.body.appendChild(iframe1);
    document.body.appendChild(iframe2);

    const DescriptionParse = new Promise((resolve) => {
      iframe1.onload = () => {
        resolve(new ReadableObject(iframe1.contentDocument.body.outerHTML));
      };
    });

    const CodeParse = new Promise((resolve) => {
      iframe2.onload = () => {
        resolve(new ReadableObject(iframe2.contentDocument.querySelector('textarea.no-mathjax.codemirror-textarea').value));
      };
    });

    const SolvedAPI = fetch(`https://solved.ac/api/v3/problem/show?problemId=${problemId}`, { method: 'GET' });
    return Promise.all([DescriptionParse, CodeParse, SolvedAPI])
      .then(([despResponse, codeResponse, solvedResponse]) => Promise.all([despResponse.text(), codeResponse.text(), solvedResponse.json()]))
      .then(([descriptionText, codeText, solvedJson]) => {
        /* Get Question Description */
        const parser = new DOMParser();
        const doc = parser.parseFromString(descriptionText, 'text/html');

        const problem_description = `${unescapeHtml(doc.getElementById('problem_description').innerHTML.trim())}`;
        const problem_input = isNull((problem_input_el = doc.getElementById('problem_input'))) ? 'Empty' : `${unescapeHtml(problem_input_el.innerHTML.trim())}`;
        const problem_output = isNull((problem_output_el = doc.getElementById('problem_output'))) ? 'Empty' : `${unescapeHtml(problem_output_el.innerHTML.trim())}`;

        /* Get Code */
        const code = codeText;
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
  return selectBestSubmissionList(await findResultTableListByUsername(username));
}

/**
 * user가 "맞았습니다!!" 결과를 맞은 모든 제출 결과 리스트를 가져오는 함수
 * @param username: 백준 아이디
 * @return Promise<Array<Object>>
 */
async function findResultTableListByUsername(username) {
  const result = [];
  let doc = await findHtmlDocumentByUrl(`https://www.acmicpc.net/status?user_id=${username}&result_id=4`);
  let next_page = doc.getElementById('next_page');
  do {
    result.push(...parsingResultTableList(doc));
    if (next_page !== null) doc = await findHtmlDocumentByUrl(next_page.getAttribute('href'));
  } while ((next_page = doc.getElementById('next_page')) !== null);
  result.push(...parsingResultTableList(doc));

  return result;
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
