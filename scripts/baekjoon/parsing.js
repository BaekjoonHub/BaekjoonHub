/*
  문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
  모든 해당 파일의 모든 함수는 findData()를 통해 호출됩니다.
*/

function parseSampleData(doc = document) {
  const samples = [];
  let i = 1;
  while (true) {
    const inputContainer = doc.querySelector(`#sample-input-${i}`);
    const outputContainer = doc.querySelector(`#sample-output-${i}`);
    if (!inputContainer && !outputContainer) break;
    const inputEl = inputContainer?.tagName === 'PRE' ? inputContainer : inputContainer?.querySelector('pre');
    const outputEl = outputContainer?.tagName === 'PRE' ? outputContainer : outputContainer?.querySelector('pre');
    samples.push({
      input: inputEl ? inputEl.innerText : '',
      output: outputEl ? outputEl.innerText : '',
    });
    i++;
  }
  return samples;
}

function samplesToFileEntries(samples) {
  if (samples.length === 0) return [];
  const entries = [];
  const useNumber = samples.length > 1;
  samples.forEach((sample, idx) => {
    const suffix = useNumber ? (idx + 1) : '';
    entries.push({ filename: `input${suffix}.txt`, content: sample.input });
    entries.push({ filename: `output${suffix}.txt`, content: sample.output });
  });
  return entries;
}

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
      let table = findFromResultTable();
      if (isEmpty(table)) return null;
      table = filter(table, {
        'resultCategory': RESULT_CATEGORY.RESULT_ACCEPTED,
        'username': findUsername(),
        'language': table[0]["language"]
      })
      if (isEmpty(table)) return null;
      // 자동 업로드 시 가장 최근 accepted 제출을 사용 (과거 best가 아닌 현재 제출)
      data = table[0];
    }
    return await findDataOfSubmission(data);
  } catch (error) {
    console.error(error);
  }
  return null;
}

/**
 * 제출 하나(제출 목록의 한 줄)의 문제 정보와 코드를 가져와 올릴 내용을 만듭니다. 가져오지 못하면 이유를 담아 throw 합니다.
 * @param {object} data - 제출 목록의 한 줄 { problemId, submissionId, language, … }
 * @returns {Promise<object>} data 에 문제 정보와 { directory, fileName, message, readme, code, samples } 를 더한 것
 */
async function findDataOfSubmission(data) {
  if (isNaN(Number(data.problemId)) || Number(data.problemId) < 1000) throw new Error(`정책상 대회 문제는 업로드 되지 않습니다. 대회 문제가 아니라고 판단된다면 이슈로 남겨주시길 바랍니다.\n문제 ID: ${data.problemId}`);
  const info = await findProblemInfoAndSubmissionCode(data.problemId, data.submissionId);
  if (isNull(info)) throw new Error('제출 번호를 찾지 못했습니다.');
  data = { ...data, ...info };
  const detail = await makeDetailMessageAndReadme(preProcessEmptyObj(data));
  return { ...data, ...detail }; // detail 만 반환해도 되나, 확장성을 위해 모든 데이터를 반환합니다.
}

/**
 * 문제의 상세 정보를 가지고, 문제의 업로드할 디렉토리, 파일명, 커밋 메시지, 문제 설명을 파싱하여 반환합니다.
 * @param {Object} data
 * @returns {Object} { directory, fileName, message, readme, code }
 */
async function makeDetailMessageAndReadme(data) {
  const { problemId, submissionId, result, title, level, problem_tags,
    problem_description, problem_input, problem_output, submissionTime,
    code, language, memory, runtime, samples, deleted } = data;
  const score = parseNumberFromString(result);
  const directory = await buildDirectory('baekjoon', {
    platform: '백준',
    level: level.replace(/ .*/, ''),
    levelFull: level,
    id: problemId,
    title: convertSingleCharToDoubleChar(title),
    language: langVersionRemove(language),
    _defaultDir: `백준/${level.replace(/ .*/, '')}/${problemId}. ${convertSingleCharToDoubleChar(title)}`,
  });
  const message = `[${level}] Title: ${title}, Time: ${runtime} ms, Memory: ${memory} KB`
    + ((isNaN(score)) ? ' ' : `, Score: ${score} point `) // 서브 태스크가 있는 문제로, 점수가 있는 경우 점수까지 커밋 메시지에 표기
    + `-BaekjoonHub`;
  const category = problem_tags.join(', ');
  const fileName = `${convertSingleCharToDoubleChar(title)}.${getLanguageExtension(language)}`;
  const dateInfo = submissionTime ?? getDateString(new Date(Date.now()));
  // prettier-ignore-start
  const readme = `# [${level}] ${title} - ${problemId} \n\n`
    + `[문제 링크](https://acmicpc.net/problem/${problemId}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory} KB, `
    + `시간: ${runtime} ms\n\n`
    + `### 분류\n\n`
    + `${category || "Empty"}\n\n`
    + (deleted
        ? `### 안내\n\n`
          + `이 문제는 출제자에 의해 삭제되었거나 비공개 상태로 전환되어 설명을 가져올 수 없습니다.\n\n`
          + `### 제출 일자\n\n${dateInfo}\n\n`
        : (!!problem_description
            ? ''
              + `### 제출 일자\n\n`
              + `${dateInfo}\n\n`
              + `### 문제 설명\n\n${problem_description}\n\n`
              + `### 입력 \n\n ${problem_input}\n\n`
              + `### 출력 \n\n ${problem_output}\n\n`
            : ''));
  // prettier-ignore-end
  return {
    directory,
    fileName,
    message,
    readme,
    code,
    samples
  };
}

/*
  현재 로그인된 유저를 파싱합니다.
*/
function findUsername() {
  const el = document.querySelector('a.username');
  if (isNull(el)) return null;
  const username = el?.innerText?.trim();
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
          /* 화면에 그려진 표에서는 백준의 툴팁 스크립트가 제출 시각을 data-original-title 에 둔다(예: 2026년 11월 20일 11:38:30).
             전체 업로드가 fetch 로 받은 표에는 그 값이 없어 README 의 제출 일자가 올린 시각이 됐다. 그때는 data-timestamp(초)로 같은 모양을 만든다. */
          const timestamp = Number(el.getAttribute('data-timestamp'));
          return el.getAttribute('data-original-title') || (timestamp ? getDateString(new Date(timestamp * 1000)) : null);
        case 'problemId':
          const a = x.querySelector('a.problem_title');
          if (isNull(a)) return null;
          return {
            problemId: a.getAttribute('href').replace(/^.*\/([0-9]+)$/, '$1'),
          };
        default:
          return x.innerText.trim();
      }
    });
    let obj = {};
    obj.elementId = row.id;
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cells[j];
    }
    obj = { ...obj, ...obj.result, ...obj.problemId};
    list.push(obj);
  }
  log('TableList', list);
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
    log('Result table not found');
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
function parseProblemDescription(doc = document) {
  const descEl = doc.getElementById('problem_description');
  if (isNull(descEl)) return {};
  convertImageTagAbsoluteURL(descEl); //이미지에 상대 경로가 있을 수 있으므로 이미지 경로를 절대 경로로 전환 합니다.
  const problemId = doc.getElementsByTagName('title')[0]?.textContent?.split(':')[0]?.replace(/[^0-9]/, '') || '';
  const problem_description = unescapeHtml(descEl.innerHTML.trim());
  const problem_input = doc.getElementById('problem_input')?.innerHTML.trim?.().unescapeHtml?.() || 'Empty'; // eslint-disable-line
  const problem_output = doc.getElementById('problem_output')?.innerHTML.trim?.().unescapeHtml?.() || 'Empty'; // eslint-disable-line
  const samples = parseSampleData(doc);
  if (problemId && problem_description) {
    log(`문제번호 ${problemId}의 내용을 저장합니다.`);
    updateProblemsFromStats({ problemId, problem_description, problem_input, problem_output, samples});
    return { problemId, problem_description, problem_input, problem_output, samples};
  }
  return {};
}

/* 백준은 요청이 짧은 시간에 몰리면 한동안 403 을 준다(2026-11-26 전체 업로드에서 간격 없이 보냈을 때 80초 동안 900번째 요청쯤부터,
   20초 안에 풀렸다). 그 응답은 문제 페이지도 제출 코드도 아니다. 한도는 공개되어 있지 않아, 요청의 시작 시각을 띄워 보내다가
   막히면 간격을 두 배로 늘리고 모든 요청을 쉬었다가 다시 보낸다. 끝내 막혀 있으면 전체 업로드는 멈춰서 이어하기를 기다리고
   (남은 문제마다 다시 기다리다 실패하지 않게), 그 밖의 업로드는 오류로 알린다. */
const BOJ_BLOCKED_WAITS_MS = [5000, 10000, 20000, 40000];
const BOJ_MAX_GAP_MS = 1000;
let bojGapMs = 200;
let bojNextAt = 0;
let bojBlockedUntil = 0;

async function sleepUntil(time) {
  while (Date.now() < time) await new Promise((resolve) => setTimeout(resolve, time - Date.now()));
}

async function fetchBoj(url) {
  for (let attempt = 0; ; attempt += 1) {
    await multiloader.modal?.running(); // 전체 업로드가 멈춰 있으면 이어하기를 기다린다
    await sleepUntil(bojBlockedUntil); // 다른 요청이 막혀서 미룬 시각까지 함께 기다린다
    const startAt = Math.max(Date.now(), bojNextAt);
    bojNextAt = startAt + bojGapMs;
    await sleepUntil(startAt);
    const res = await fetch(url, { method: 'GET' });
    if (res.status !== 403 && res.status !== 429) return res;
    if (attempt >= BOJ_BLOCKED_WAITS_MS.length) {
      if (!multiloader.modal) throw new Error(`백준이 요청을 막고 있습니다 (${res.status}). 잠시 후 다시 시도해 주세요.`);
      multiloader.modal.pause('백준이 요청을 계속 막고 있어 멈췄습니다. 몇 분 뒤 이어하기를 눌러 주세요.');
      attempt = -1; // 이어하면 처음부터 다시 센다
      continue;
    }
    // 막힌 줄 모르고 보낸 요청이 막혔을 때만 늦춘다 (같은 차단에 걸린 다른 요청과 다시 보낸 요청은 세지 않는다)
    if (attempt === 0 && Date.now() >= bojBlockedUntil) bojGapMs = Math.min(bojGapMs * 2, BOJ_MAX_GAP_MS);
    bojBlockedUntil = Math.max(bojBlockedUntil, Date.now() + BOJ_BLOCKED_WAITS_MS[attempt]);
    updateMultiLoader({ note: '백준이 요청을 잠시 막아 기다리는 중입니다. 풀리면 이어서 진행합니다.' });
  }
}

async function fetchProblemDescriptionById(problemId) {
  const res = await fetchBoj(`/problem/${problemId}`);
  if (res.status === 404) {
    // 404 = 출제자가 삭제했거나 비공개 처리된 문제. 제출 이력엔 남아있어 업로드 대상에 포함되지만
    // 설명 페이지는 가져올 수 없다. 소스코드는 보존하고 README에 안내를 남기도록 placeholder 반환.
    return {
      problemId: String(problemId),
      deleted: true,
      problem_description: '',
      problem_input: '',
      problem_output: '',
      samples: [],
    };
  }
  if (!res.ok) throw new Error(`백준 요청 실패 (${res.status}) /problem/${problemId}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return parseProblemDescription(doc);
}

async function fetchSubmitCodeById(submissionId) {
  const res = await fetchBoj(`/source/download/${submissionId}`);
  // 오류 응답의 본문을 풀이 코드로 올리지 않는다
  if (!res.ok) throw new Error(`백준 요청 실패 (${res.status}) /source/download/${submissionId}`);
  return res.text();
}

async function fetchSolvedACById(problemId) {
  return chrome.runtime.sendMessage({sender: "baekjoon", task : "SolvedApiCall", problemId : problemId});
}

async function getProblemDescriptionById(problemId) {
  let problem = await getProblemFromStats(problemId);
  if (isNull(problem)) {
    problem = await fetchProblemDescriptionById(problemId);
    if (problem && problem.problemId && problem.problem_description) {
      updateProblemsFromStats(problem); // not await
    }
  }
  return problem;
}

async function getSubmitCodeById(submissionId) {
  let code = await getSubmitCodeFromStats(submissionId);
  // v1.7.2 까지는 막힌 요청의 403 응답 본문을 코드로 캐시했다. 캐시 수명(1주)이 지난 뒤에는 이 검사를 지워도 된다.
  if (isNull(code) || code.includes('<title>403</title>403 Forbidden')) {
    code = await fetchSubmitCodeById(submissionId);
    updateSubmitCodeFromStats({ submissionId, code }); // not await
  }
  return code;
}

async function getSolvedACById(problemId) {
  let jsonData = await getSolvedACFromStats(problemId);
  if (isNull(jsonData)) {
    jsonData = await fetchSolvedACById(problemId);
    updateSolvedACFromStats({ problemId, jsonData }); // not await
  }
  return jsonData;
}

/**
 * 제출 소스코드, 문제 설명, 예시 입력, 예시 출력, 문제 태그를 반환합니다.
 * @param {Object} problemId
 * @param {Object} submissionId
 * @returns {Object} { problemId, submissionId, code, problem_description, problem_input, problem_output, problem_tags }
 */
async function findProblemInfoAndSubmissionCode(problemId, submissionId) {
  log('in find with promise');
  if (isNull(problemId) || isNull(submissionId)) return null;
  const [description, code, solvedJson] = await Promise.all([
    getProblemDescriptionById(problemId),
    getSubmitCodeById(submissionId),
    getSolvedACById(problemId),
  ]);
  // solved.ac 응답이 없어도(429 지속 실패, service worker 재기동 등) 업로드는 진행되도록 fallback.
  const safeSolved = solvedJson || {};
  const problem_tags = Array.isArray(safeSolved.tags)
    ? safeSolved.tags.flatMap((tag) => tag.displayNames).filter((tag) => tag.language === 'ko').map((tag) => tag.name)
    : [];
  const title = safeSolved.titleKo || `문제 ${problemId}`;
  const level = bj_level[safeSolved.level] || bj_level[0];

  const { problem_description, problem_input, problem_output, samples, deleted } = description || {};
  return {
    problemId, submissionId, title, level, code,
    problem_description, problem_input, problem_output, problem_tags,
    samples: samples || [],
    deleted: Boolean(deleted),
  };
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
  let doc = await findHtmlDocumentByUrl(`/status?user_id=${username}&result_id=4`);
  if (doc.getElementById('status-table') === null) {
    throw new Error('status-table을 찾을 수 없습니다. 로그인/백준 페이지 상태를 확인해 주세요.');
  }
  let next_page = doc.getElementById('next_page');
  do {
    result.push(...parsingResultTableList(doc));
    if (next_page !== null) {
      const href = next_page.getAttribute('href');
      const nextUrl = new URL(href, location.origin).toString();
      doc = await findHtmlDocumentByUrl(nextUrl);
    }
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
  const res = await fetchBoj(url);
  if (!res.ok) throw new Error(`백준 요청 실패 (${res.status}) ${url}`);
  const text = await res.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, 'text/html');
}

/**
 * 백준이 표기한 언어에서 공백으로 띄운 버전을 뗍니다. ("Python 3.8" → "Python", "Java 11" → "Java", "PyPy3" 는 그대로)
 * @param {string} lang
 * @return {string}
 */
function langVersionRemove(lang) {
  const parts = lang.split(' ');
  if (/^\d/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(' ');
}
