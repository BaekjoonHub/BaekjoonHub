/**
 * 문제를 정상적으로 풀면 제출한 소스코드를 파싱하고, 로컬스토리지에 저장하는 함수입니다.
 */
async function parseCode() {
  const problemId = document.querySelector('div.problem_box > h3').innerText.replace(/\..*$/, '').trim();
  const contestProbId = [...document.querySelectorAll('#contestProbId')].slice(-1)[0].value;
  updateTextSourceEvent();
  const code = document.querySelector('#textSource').value;
  await updateProblemData(problemId, { code, contestProbId });
  return { problemId, contestProbId };
}

/*
  cEditor 소스코드의 정보를 textSource에 저장하도록 하는 함수 입니다. 
*/
function updateTextSourceEvent() {
  document.documentElement.setAttribute('onreset', 'cEditor.save();');
  document.documentElement.dispatchEvent(new CustomEvent('reset'));
  document.documentElement.removeAttribute('onreset');
}

/**
 * 여러 개의 selector 후보를 순서대로 시도해 가장 먼저 매칭되는 요소를 반환합니다.
 * SWEA DOM 구조 변경에 대비해 절대 경로 selector 대신 fallback 체인을 사용합니다.
 * @param {string[]} selectors - 시도할 selector 목록 (우선순위 순)
 * @param {ParentNode} [root=document] - 탐색 기준 노드
 * @returns {Element|null}
 */
function querySelectorFallback(selectors, root = document) {
  for (const selector of selectors) {
    try {
      const el = root.querySelector(selector);
      if (!isNull(el)) return el;
    } catch (e) {
      /* 유효하지 않은 selector는 무시 */
    }
  }
  return null;
}

/** 요소의 텍스트를 안전하게 추출합니다. null이면 빈 문자열을 반환합니다. */
function safeText(el) {
  return isNull(el) ? '' : (el.textContent || el.innerText || '').trim();
}

/** 조회 중인(검색창) 닉네임을 추출합니다. */
function getSearchedNickname() {
  const el = querySelectorFallback(['#searchinput', 'input[name="searchinput"]', 'input#searchinput']);
  return (el?.value || '').trim();
}

/** 문제 번호를 여러 fallback으로 추출합니다. */
function parseProblemId() {
  // 1. 문제 박스 내 순수 문제번호 p (problem_title 클래스 제외)
  let text = safeText(querySelectorFallback([
    'div.problem_box > p:not(.problem_title)',
    'body > div.container > div.container.sub > div > div.problem_box > p',
  ]));
  // 2. h3 ("1234. 제목 D2") 형태에서 추출
  if (isEmpty(text)) {
    text = safeText(querySelectorFallback(['div.problem_box > h3', 'div.problem_box h3']));
  }
  return text.split('.')[0].replace(/[^0-9]/g, '').trim();
}

/** contestProbId를 히든 input 우선, 없으면 URL 파라미터에서 추출합니다. */
function parseContestProbId() {
  const inputs = [...document.querySelectorAll('#contestProbId, input[name="contestProbId"]')];
  for (let i = inputs.length - 1; i >= 0; i--) {
    const v = (inputs[i].value || '').trim();
    if (v) return v;
  }
  return (new URLSearchParams(window.location.search).get('contestProbId') || '').trim();
}

/** 제출 정보(언어/메모리/실행시간/코드길이)를 info 박스에서 추출합니다. */
function parseSubmissionInfo(infoBox) {
  let items = [...infoBox.querySelectorAll('ul > li')];
  if (items.length === 0) items = [...infoBox.querySelectorAll('li')];
  const pick = (li) => {
    if (isNull(li)) return '';
    return safeText(li.querySelector('span')) || safeText(li);
  };
  return {
    language: pick(items[0]),
    memory: pick(items[1]).toUpperCase(),
    runtime: pick(items[2]),
    length: pick(items[3]),
  };
}

/** 제출 일시를 날짜 패턴 매칭으로 추출합니다. */
function parseSubmissionTime() {
  const datePattern = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/;
  const candidates = [
    querySelectorFallback(['.smt_txt > dd', '.smt_txt dd', '.smt_txt']),
    querySelectorFallback(['div.problem_box', '#problemForm']),
  ];
  for (const el of candidates) {
    const m = safeText(el).match(datePattern);
    if (m) return m[0];
  }
  return '';
}

/*
  문제 요약과 코드를 파싱합니다.
  - directory : 레포에 기록될 폴더명
  - message : 커밋 메시지
  - fileName : 파일명
  - readme : README.md에 작성할 내용
  - code : 소스코드 내용
*/
async function parseData() {
  const searchedNickname = getSearchedNickname();
  const myNickname = getNickname();
  log('SWEA 파싱 시작 - 로그인 유저:', myNickname, '조회 유저:', searchedNickname);

  // 검색 중인 유저와 로그인 유저가 다르면 업로드하지 않음
  // (둘 중 하나라도 비어 있으면 selector 변동 가능성을 고려해 검사를 통과시킴)
  if (myNickname && searchedNickname && myNickname !== searchedNickname) {
    log('로그인 유저와 조회 유저가 달라 업로드를 건너뜁니다.');
    return;
  }

  // 제출 정보(언어/메모리/시간/코드길이) 영역
  const infoBox = querySelectorFallback(['#problemForm div.info', 'div.problem_box div.info', 'div.info']);
  if (isNull(infoBox)) {
    console.error('[BaekjoonHub] SWEA 제출 정보 영역(div.info)을 찾지 못했습니다. SWEA DOM 구조 변경 가능성이 있습니다.');
    return;
  }

  log('결과 데이터 파싱 시작');

  // 문제 제목
  const titleEl = querySelectorFallback(['div.problem_box > p.problem_title', 'div.problem_box p.problem_title', '.problem_title']);
  let title = safeText(titleEl)
    .replace(/ D[0-9]$/, '')
    .replace(/^[^.]*/, '')
    .replace(/^\./, '')
    .trim();
  if (isEmpty(title)) {
    // fallback: h3 ("1234. 제목 D2")에서 제목만 추출
    title = safeText(querySelectorFallback(['div.problem_box > h3', 'div.problem_box h3']))
      .replace(/ D[0-9]$/, '')
      .replace(/^[^.]*\.?/, '')
      .trim();
  }

  // 레벨
  const level = safeText(querySelectorFallback([
    'div.problem_box > p.problem_title > span.badge',
    'div.problem_box p.problem_title span.badge',
    'div.problem_box .badge',
  ])) || 'Unrated';

  // 문제번호
  const problemId = parseProblemId();
  // 문제 콘테스트 인덱스
  const contestProbId = parseContestProbId();
  if (isEmpty(problemId) || isEmpty(contestProbId)) {
    console.error('[BaekjoonHub] SWEA 문제 번호/contestProbId 파싱에 실패했습니다.', { problemId, contestProbId });
    return;
  }
  // 문제 링크
  const link = `${window.location.origin}/main/code/problem/problemDetail.do?contestProbId=${contestProbId}`;

  // 문제 언어, 메모리, 시간소요, 코드길이
  const { language, memory, runtime, length } = parseSubmissionInfo(infoBox);
  if (isEmpty(language)) {
    console.error('[BaekjoonHub] SWEA 제출 언어 파싱에 실패했습니다.');
    return;
  }

  // 확장자명
  const extension = languages[language.toLowerCase()];

  // 제출날짜
  const submissionTime = parseSubmissionTime();

  // 로컬스토리지에서 제출 코드를 불러옴 (problemId 우선, 실패 시 contestProbId로 조회)
  let data = await getProblemData(problemId);
  if (isNull(data?.code)) {
    data = await getProblemDataByContestProbId(contestProbId);
  }
  log('data', data);
  if (isNull(data?.code)) {
    console.error('[BaekjoonHub] 저장된 SWEA 소스코드 데이터가 없습니다.', { problemId, contestProbId });
    return;
  }
  const code = data.code;
  log('파싱 완료');
  // eslint-disable-next-line consistent-return
  return makeData({ link, problemId, level, title, extension, code, runtime, memory, length, submissionTime, language});
}

async function makeData(origin) {
  const { link, problemId, level, extension, title, runtime, memory, code, length, submissionTime, language } = origin;
  /*
  * SWEA의 경우에는 JAVA 같이 모두 대문자인 경우가 존재합니다. 하지만 타 플랫폼들(백준, 프로그래머스)는 첫문자가 모두 대문자로 시작합니다.
  * 그래서 이와 같은 케이스를 처리를 위해 첫문자만 대문자를 유지하고 나머지 문자는 소문자로 변환합니다.
  * C++ 같은 경우에는 문자가 그대로 유지됩니다.
  * */
  const lang = (language === language.toUpperCase()) ? language.substring(0, 1) + language.substring(1).toLowerCase() : language
  const directory = await buildDirectory('swea', {
    platform: 'SWEA',
    level,
    id: problemId,
    title: convertSingleCharToDoubleChar(title),
    language: lang,
    _defaultDir: `SWEA/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`,
  });
  const message = `[${level}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${extension}`;
  const dateInfo = isEmpty(submissionTime) ? getDateString(new Date(Date.now())) : submissionTime;
  // prettier-ignore
  const readme =
    `# [${level}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}, `
    + `코드길이: ${length} Bytes\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`
    + `\n\n`
    + `> 출처: SW Expert Academy, https://swexpertacademy.com/main/code/problem/problemList.do`;
  return { problemId, directory, message, fileName, readme, code };
}

/**
 * stats에서 이미 업로드된 SWEA 문제 ID를 추출합니다.
 */
function extractUploadedProblemIdsForSWEA(stats, hook) {
  const uploadedIds = new Set();
  if (isNull(stats) || isNull(stats.submission) || isNull(hook)) return uploadedIds;

  const parts = hook.split('/');
  if (parts.length < 2) return uploadedIds;
  const owner = parts[0];
  const repo = parts[1];

  const ownerObj = stats.submission[owner];
  if (isNull(ownerObj)) return uploadedIds;
  const repoObj = ownerObj[repo];
  if (isNull(repoObj)) return uploadedIds;

  function extractFromNode(node) {
    if (isNull(node)) return;
    for (const key of Object.keys(node)) {
      const match = key.match(/^(\d+)/);
      if (match) {
        uploadedIds.add(match[1]);
      }
    }
  }

  // 직접 모드: submission[owner][repo]["SWEA"]["1234.제목"]
  if (!isNull(repoObj['SWEA'])) {
    extractFromNode(repoObj['SWEA']);
  }

  // language 모드: submission[owner][repo][lang]["SWEA"]["1234.제목"]
  for (const key of Object.keys(repoObj)) {
    if (key === 'SWEA') continue;
    const langNode = repoObj[key];
    if (!isNull(langNode) && typeof langNode === 'object' && !isNull(langNode['SWEA'])) {
      extractFromNode(langNode['SWEA']);
    }
  }

  return uploadedIds;
}

/**
 * SWEA userCode.do 페이지에서 모든 풀이 완료된 문제를 파싱합니다.
 * userCode.do 페이지는 로그인한 사용자의 코드 목록을 보여주며,
 * AJAX로 페이지네이션된 테이블을 가져옵니다.
 */
async function findAllSolvedProblemsSWEA() {
  const problems = [];
  // userCode.do 페이지의 테이블에서 문제 목록을 추출
  const rows = document.querySelectorAll('table tbody tr, .problem_list tbody tr, .code_list tbody tr');
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) continue;
    // 상태 확인 - "풀이중"이 아닌 완료된 항목만
    const statusCell = cells[cells.length - 1];
    const status = statusCell ? statusCell.textContent.trim() : '';
    if (status.includes('풀이중')) continue;

    // 문제번호와 제목 추출
    const linkEl = row.querySelector('a[href*="contestProbId"], a[href*="problemDetail"]');
    if (!linkEl) continue;
    const href = linkEl.getAttribute('href') || '';
    const contestProbIdMatch = href.match(/contestProbId=(\d+)/);
    const contestProbId = contestProbIdMatch ? contestProbIdMatch[1] : '';

    const problemIdEl = cells[0];
    const problemId = problemIdEl ? problemIdEl.textContent.trim() : '';
    const title = linkEl.textContent.trim();

    // 레벨 추출
    const levelEl = row.querySelector('.badge, span[class*="level"]');
    const level = levelEl ? levelEl.textContent.trim() : (cells[2] ? cells[2].textContent.trim() : 'Unrated');

    if (problemId && contestProbId) {
      problems.push({ problemId, contestProbId, title, level });
    }
  }

  // 페이지네이션 처리 - 다음 페이지가 있으면 fetch로 가져옴
  const paginationLinks = document.querySelectorAll('.pagination a, .paging a');
  const visitedPages = new Set(['1']);
  for (const pageLink of paginationLinks) {
    const pageHref = pageLink.getAttribute('href') || pageLink.getAttribute('onclick') || '';
    const pageMatch = pageHref.match(/(\d+)/);
    if (!pageMatch || visitedPages.has(pageMatch[1])) continue;
    visitedPages.add(pageMatch[1]);

    try {
      const userId = new URLSearchParams(window.location.search).get('userId');
      const res = await fetch(`/main/userpage/code/userCode.do?userId=${userId}&pageNo=${pageMatch[1]}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const pageRows = doc.querySelectorAll('table tbody tr, .problem_list tbody tr, .code_list tbody tr');
      for (const row of pageRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) continue;
        const statusCell = cells[cells.length - 1];
        const status = statusCell ? statusCell.textContent.trim() : '';
        if (status.includes('풀이중')) continue;

        const linkEl = row.querySelector('a[href*="contestProbId"], a[href*="problemDetail"]');
        if (!linkEl) continue;
        const href = linkEl.getAttribute('href') || '';
        const contestProbIdMatch = href.match(/contestProbId=(\d+)/);
        const contestProbId = contestProbIdMatch ? contestProbIdMatch[1] : '';

        const problemIdEl = cells[0];
        const problemId = problemIdEl ? problemIdEl.textContent.trim() : '';
        const title = linkEl.textContent.trim();

        const levelEl = row.querySelector('.badge, span[class*="level"]');
        const level = levelEl ? levelEl.textContent.trim() : (cells[2] ? cells[2].textContent.trim() : 'Unrated');

        if (problemId && contestProbId) {
          problems.push({ problemId, contestProbId, title, level });
        }
      }
    } catch (e) {
      console.error(`Failed to fetch page ${pageMatch[1]}:`, e);
    }
  }

  return problems;
}

/**
 * SWEA 제출 이력에서 Pass된 코드를 가져옵니다.
 */
async function fetchSWEASubmissionCode(problemInfo) {
  const { problemId, contestProbId, title, level } = problemInfo;
  try {
    // Step 1: 제출 이력 페이지에서 Pass된 제출 찾기
    const historyRes = await fetch(`/main/code/problem/problemSubmitHistory.do?contestProbId=${contestProbId}`);
    const historyHtml = await historyRes.text();
    const historyDoc = new DOMParser().parseFromString(historyHtml, 'text/html');

    // Pass된 제출 행 찾기
    const historyRows = historyDoc.querySelectorAll('table tbody tr');
    let passRow = null;
    for (const row of historyRows) {
      const resultCell = row.querySelector('td.pass, td .pass, td');
      if (resultCell && resultCell.textContent.trim().toLowerCase().includes('pass')) {
        passRow = row;
        break;
      }
    }
    if (!passRow) return null;

    // 코드 보기 링크에서 solutionId 추출
    const codeLink = passRow.querySelector('a[href*="problemSubmitDetail"], a[onclick*="problemSubmitDetail"]');
    let detailUrl = '';
    if (codeLink) {
      const onclick = codeLink.getAttribute('onclick') || '';
      const hrefAttr = codeLink.getAttribute('href') || '';
      if (onclick) {
        // onclick에서 파라미터 추출
        const params = onclick.match(/\(([^)]+)\)/);
        if (params) detailUrl = `/main/code/problem/problemSubmitDetail.do?${params[1]}`;
        else detailUrl = hrefAttr;
      } else {
        detailUrl = hrefAttr;
      }
    }

    if (!detailUrl) return null;

    // Step 2: 코드 상세 페이지에서 소스코드 추출
    const detailRes = await fetch(detailUrl);
    const detailHtml = await detailRes.text();
    const detailDoc = new DOMParser().parseFromString(detailHtml, 'text/html');

    // 코드 블록에서 소스코드 추출
    const codeEl = detailDoc.querySelector('pre code, .code-viewer pre, textarea#source, #textSource, pre.code');
    const code = codeEl ? codeEl.textContent : '';
    if (!code) return null;

    // 메타데이터 추출
    const infoEls = detailDoc.querySelectorAll('.info li span, .submit_info span');
    const languageRaw = infoEls[0] ? infoEls[0].textContent.trim() : 'C++';
    const memory = infoEls[1] ? infoEls[1].textContent.trim().toUpperCase() : '';
    const runtime = infoEls[2] ? infoEls[2].textContent.trim() : '';
    const length = infoEls[3] ? infoEls[3].textContent.trim() : '';

    const language = (languageRaw === languageRaw.toUpperCase())
      ? languageRaw.substring(0, 1) + languageRaw.substring(1).toLowerCase()
      : languageRaw;
    const extension = languages[languageRaw.toLowerCase()] || 'txt';

    const link = `https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=${contestProbId}`;

    return await makeDataForBulkUploadSWEA({
      link, problemId, level, title, extension, code, runtime, memory, length, language
    });
  } catch (e) {
    console.error(`Failed to fetch SWEA problem ${problemId}:`, e);
    return null;
  }
}

/**
 * SWEA 일괄 업로드용 데이터를 생성합니다.
 */
async function makeDataForBulkUploadSWEA(origin) {
  const { link, problemId, level, extension, title, runtime, memory, code, length, language } = origin;
  const directory = await buildDirectory('swea', {
    platform: 'SWEA',
    level,
    id: problemId,
    title: convertSingleCharToDoubleChar(title),
    language,
    _defaultDir: `SWEA/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`,
  });
  const message = `[${level}] Title: ${title} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${extension}`;
  const dateInfo = getDateString(new Date(Date.now()));
  const readme =
    `# [${level}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}, `
    + `코드길이: ${length} Bytes\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`
    + `\n\n`
    + `> 출처: SW Expert Academy, https://swexpertacademy.com/main/code/problem/problemList.do`;
  return { problemId, directory, message, fileName, readme, code };
}
