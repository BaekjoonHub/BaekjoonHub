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

/*
  문제 요약과 코드를 파싱합니다.
  - directory : 레포에 기록될 폴더명
  - message : 커밋 메시지
  - fileName : 파일명
  - readme : README.md에 작성할 내용
  - code : 소스코드 내용
*/
async function parseData() {
  const nickname = document.querySelector('#searchinput').value;

  log('사용자 로그인 정보 및 유무 체크', nickname, document.querySelector('#problemForm div.info'));
  // 검색하는 유저 정보와 로그인한 유저의 닉네임이 같은지 체크
  // PASS를 맞은 기록 유무 체크
  if (getNickname() !== nickname) return;
  if (isNull(document.querySelector('#problemForm div.info'))) return;

  log('결과 데이터 파싱 시작');

  const title = document
    .querySelector('div.problem_box > p.problem_title')
    .innerText.replace(/ D[0-9]$/, '')
    .replace(/^[^.]*/, '')
    .substr(1)
    .trim();
  // 레벨
  const level = document.querySelector('div.problem_box > p.problem_title > span.badge')?.textContent || 'Unrated';
  // 문제번호
  const problemId = document.querySelector('body > div.container > div.container.sub > div > div.problem_box > p').innerText.split('.')[0].trim();
  // 문제 콘테스트 인덱스
  const contestProbId = [...document.querySelectorAll('#contestProbId')].slice(-1)[0].value;
  // 문제 링크
  const link = `${window.location.origin}/main/code/problem/problemDetail.do?contestProbId=${contestProbId}`;

  // 문제 언어, 메모리, 시간소요
  const language = document.querySelector('#problemForm div.info > ul > li:nth-child(1) > span:nth-child(1)').textContent.trim();
  const memory = document.querySelector('#problemForm div.info > ul > li:nth-child(2) > span:nth-child(1)').textContent.trim().toUpperCase();
  const runtime = document.querySelector('#problemForm div.info > ul > li:nth-child(3) > span:nth-child(1)').textContent.trim();
  const length = document.querySelector('#problemForm div.info > ul > li:nth-child(4) > span:nth-child(1)').textContent.trim();

  // 확장자명
  const extension = languages[language.toLowerCase()];

  // 제출날짜
  const submissionTime = document.querySelector('.smt_txt > dd').textContent.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g)[0];
  // 로컬스토리지에서 기존 코드에 대한 정보를 불러올 수 없다면 코드 디테일 창으로 이동 후 제출하도록 이동
  const data = await getProblemData(problemId);
  log('data', data);
  if (isNull(data?.code)) {
    // 기존 문제 데이터를 로컬스토리지에 저장하고 코드 보기 페이지로 이동
    // await updateProblemData(problemId, { level, contestProbId, link, language, memory, runtime, length, extension });
    // const contestHistoryId = document.querySelector('div.box-list > div > div > span > a').href.replace(/^.*'(.*)'.*$/, '$1');
    // window.location.href = `${window.location.origin}/main/solvingProblem/solvingProblem.do?contestProbId=${contestProbId}`;
    console.error('소스코드 데이터가 없습니다.');
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
  const dateInfo = submissionTime ?? getDateString(new Date(Date.now()));
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
