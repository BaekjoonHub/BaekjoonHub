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

/**
 * 요소의 텍스트를 안전하게 추출합니다. null이면 빈 문자열을 반환합니다.
 * textContent 는 자식 노드 사이의 HTML 포맷팅 공백(개행/탭)을 그대로 포함하므로,
 * \s+ 를 단일 스페이스로 정규화해 경로/파일명 오염을 막습니다.
 */
function safeText(el) {
  return isNull(el) ? '' : (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
}

/** 조회 중인(검색창) 닉네임을 추출합니다. */
function getSearchedNickname(root = document) {
  const el = querySelectorFallback(['#searchinput', 'input[name="searchinput"]', 'input#searchinput'], root);
  return (el?.value || '').trim();
}

/** 문제 번호를 여러 fallback으로 추출합니다. */
function parseProblemId(root = document) {
  // 1. 문제 박스 내 순수 문제번호 p (problem_title 클래스 제외)
  let text = safeText(querySelectorFallback([
    'div.problem_box > p:not(.problem_title)',
    'body > div.container > div.container.sub > div > div.problem_box > p',
  ], root));
  // 2. h3 ("1234. 제목 D2") 형태에서 추출
  if (isEmpty(text)) {
    text = safeText(querySelectorFallback(['div.problem_box > h3', 'div.problem_box h3'], root));
  }
  return text.split('.')[0].replace(/[^0-9]/g, '').trim();
}

/** contestProbId를 히든 input 우선, 없으면 URL 쿼리 스트링에서 추출합니다. */
function parseContestProbId(root = document, search = window.location.search) {
  const inputs = [...root.querySelectorAll('#contestProbId, input[name="contestProbId"]')];
  for (let i = inputs.length - 1; i >= 0; i--) {
    const v = (inputs[i].value || '').trim();
    if (v) return v;
  }
  return (new URLSearchParams(search).get('contestProbId') || '').trim();
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
function parseSubmissionTime(root = document) {
  const datePattern = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/;
  const candidates = [
    querySelectorFallback(['.smt_txt > dd', '.smt_txt dd', '.smt_txt'], root),
    querySelectorFallback(['div.problem_box', '#problemForm'], root),
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
  @param {ParentNode} [root=document] - 파싱 기준 문서. 결과 페이지를 fetch하여
    DOMParser로 파싱한 문서를 넘기면 페이지 이동 없이 제자리 업로드가 가능하다.
  @param {string} [search=window.location.search] - contestProbId fallback용 쿼리 스트링
*/
async function parseData(root = document, search = window.location.search) {
  const searchedNickname = getSearchedNickname(root);
  const myNickname = getNickname();
  log('SWEA 파싱 시작 - 로그인 유저:', myNickname, '조회 유저:', searchedNickname);

  // 검색 중인 유저와 로그인 유저가 다르면 업로드하지 않음
  // (둘 중 하나라도 비어 있으면 selector 변동 가능성을 고려해 검사를 통과시킴)
  if (myNickname && searchedNickname && myNickname !== searchedNickname) {
    log('로그인 유저와 조회 유저가 달라 업로드를 건너뜁니다.');
    return;
  }

  // 제출 정보(언어/메모리/시간/코드길이) 영역
  const infoBox = querySelectorFallback(['#problemForm div.info', 'div.problem_box div.info', 'div.info'], root);
  if (isNull(infoBox)) {
    console.error('[BaekjoonHub] SWEA 제출 정보 영역(div.info)을 찾지 못했습니다. SWEA DOM 구조 변경 가능성이 있습니다.');
    return;
  }

  log('결과 데이터 파싱 시작');

  // 문제 제목 - badge(레벨) 자식을 함께 읽으면 "제목\n\t\tD2" 처럼 오염되므로
  // 노드를 clone 한 뒤 badge 를 제거하고 textContent 를 사용한다.
  const titleEl = querySelectorFallback(['div.problem_box > p.problem_title', 'div.problem_box p.problem_title', '.problem_title'], root);
  let rawTitle = '';
  if (!isNull(titleEl)) {
    const clone = titleEl.cloneNode(true);
    clone.querySelectorAll('.badge, span.badge').forEach((b) => b.remove());
    rawTitle = (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }
  let title = rawTitle
    .replace(/^[^.]*\.?\s*/, '') // "1859. " 제거
    .replace(/\s+D[0-9]$/i, '')  // 혹시 남은 " D2" 접미사 제거 (방어적)
    .trim();
  if (isEmpty(title)) {
    // fallback: h3 ("1234. 제목 D2")에서 제목만 추출
    title = safeText(querySelectorFallback(['div.problem_box > h3', 'div.problem_box h3'], root))
      .replace(/\s+D[0-9]$/i, '')
      .replace(/^[^.]*\.?\s*/, '')
      .trim();
  }

  // 레벨
  const level = safeText(querySelectorFallback([
    'div.problem_box > p.problem_title > span.badge',
    'div.problem_box p.problem_title span.badge',
    'div.problem_box .badge',
  ], root)) || 'Unrated';

  // 문제번호
  const problemId = parseProblemId(root);
  // 문제 콘테스트 인덱스
  const contestProbId = parseContestProbId(root, search);
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
  /* 맵에 없는 언어면 undefined 가 파일명에 박히므로(`제목.undefined`) 공용 헬퍼로 해석한다.
     대량 업로드 경로(makeDataForBulkUploadSWEA)는 이미 `|| 'txt'` 를 쓰고 있어 동작을 맞춘 것이다. */
  const extension = resolveLanguageExtension(languages, language);

  // 제출날짜
  const submissionTime = parseSubmissionTime(root);

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

/** 현재 SWEA의 카드형 제출 목록에서 문제 정보를 추출합니다. */
function parseSolvedProblemCardsSWEA(root) {
  return [...root.querySelectorAll('#submitProb .widget-box-sub')].map((card) => {
    const link = card.querySelector('.week_text a[onclick*="fn_move_prob"]');
    const contestProbId = link?.getAttribute('onclick')?.match(/fn_move_prob\('([^']+)'/)?.[1];
    const problemId = card.querySelector('.week_num')?.textContent?.replace(/\D/g, '');
    const title = link?.textContent?.replace(/\s+/g, ' ')?.trim();
    const level = card.querySelector('.badge')?.textContent?.trim() || 'Unrated';
    return problemId && contestProbId && title ? { problemId, contestProbId, title, level } : null;
  }).filter(Boolean);
}

/** SWEA 마이페이지의 모든 페이지를 읽어 이미 제출한 문제를 모읍니다. */
async function findAllSolvedProblemsSWEA() {
  const problems = parseSolvedProblemCardsSWEA(document);
  const total = Number(document.querySelector('h4.club_box_tit span')?.textContent?.trim());
  const pageSize = Number(document.querySelector('select[name="rowNum"]')?.value
    || new URLSearchParams(location.search).get('rowNum') || 20);
  if (!Number.isFinite(total) || !Number.isFinite(pageSize) || pageSize < 1 || problems.length === 0) {
    throw new Error('SWEA 제출 목록을 읽지 못했습니다.');
  }
  const url = new URL(location.href);
  // SWEA 페이지 이동은 userCode.do가 아니라 userSubmitProblem.do로 요청한다.
  url.pathname = '/main/userpage/code/userSubmitProblem.do';
  const currentPage = Number(url.searchParams.get('pageIndex') || 1);
  for (let page = 1; page <= Math.ceil(total / pageSize); page += 1) {
    if (page === currentPage) continue;
    url.searchParams.set('pageIndex', String(page));
    url.searchParams.set('rowNum', String(pageSize));
    const response = await fetch(url.toString(), { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`SWEA 제출 목록 ${page}페이지 조회 실패 (${response.status})`);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    problems.push(...parseSolvedProblemCardsSWEA(doc));
  }
  const unique = [...new Map(problems.map((problem) => [problem.problemId, problem])).values()];
  if (unique.length !== total) throw new Error(`SWEA 제출 목록 ${total}개 중 ${unique.length}개만 읽었습니다.`);
  return unique;
}

/** SWEA가 실제로 사용하는 카드형 제출 이력에서 내 Pass 기록을 찾습니다. */
function findMyPassedSubmissionSWEA(root, nickname) {
  return [...root.querySelectorAll('.problem_smt')].find((card) => {
    const name = card.querySelector('.club_name .name')?.textContent?.trim();
    const result = card.querySelector('.info .txt-success')?.textContent?.trim();
    return name === nickname && result?.toLowerCase() === 'pass';
  });
}

/** 제출 이력에서 내 코드를 가져옵니다. */
async function fetchSWEASubmissionCode(problemInfo) {
  const { problemId, contestProbId, title, level } = problemInfo;
  try {
    const nickname = getNickname();
    if (!nickname) throw new Error('SWEA 로그인 닉네임을 찾지 못했습니다.');
    // 검색창의 제출자 필터와 같은 POST 요청. 전체 제출 목록의 첫 페이지에는
    // 오래된 내 풀이가 보이지 않을 수 있어 닉네임 검색을 서버에 적용한다.
    const historyRes = await fetch('/main/code/problem/problemSubmitHistory.do', {
      method: 'POST', credentials: 'same-origin',
      body: new URLSearchParams({ contestProbId, nickName: nickname, pageIndex: '1' }),
    });
    if (!historyRes.ok) throw new Error(`제출 이력 조회 실패 (${historyRes.status})`);
    const historyDoc = new DOMParser().parseFromString(await historyRes.text(), 'text/html');
    const card = findMyPassedSubmissionSWEA(historyDoc, nickname);
    if (!card) throw new Error('내 Pass 제출을 첫 페이지에서 찾지 못했습니다.');
    const historyId = card.querySelector('a[href*="codeview("]')?.getAttribute('href')?.match(/codeview\('([^']+)'/)?.[1];
    if (!historyId) throw new Error('코드 보기 ID를 찾지 못했습니다.');

    // SWEA의 codeview()는 contestHistoryId를 담은 form을 POST한다.
    const body = new URLSearchParams({
      contestProbId, contestHistoryId: historyId, pageIndex: '1', pageSize: '20', nickName: nickname,
    });
    const detailRes = await fetch('/main/code/problem/problemSubmitDetail.do', {
      method: 'POST', credentials: 'same-origin', body,
    });
    if (!detailRes.ok) throw new Error(`코드 상세 조회 실패 (${detailRes.status})`);
    const detailDoc = new DOMParser().parseFromString(await detailRes.text(), 'text/html');
    const codeEl = detailDoc.querySelector('pre[class*="brush"], pre code, #textSource, .syntaxhighlighter td.code');
    let code = codeEl?.matches('.syntaxhighlighter td.code')
      ? [...codeEl.querySelectorAll('.line')].map((line) => line.textContent.replace(/\u00a0/g, ' ')).join('\n')
      : codeEl?.textContent;
    // 서버 응답의 코드 영역은 SyntaxHighlighter가 아직 실행되지 않은 상태다.
    // 원문 태그 종류가 달라도 code_wrap 내부 텍스트를 읽는다.
    const codeWrap = detailDoc.querySelector('.code_wrap');
    if (!code?.trim()) code = codeWrap?.textContent?.replace(/<!\[CDATA\[|\]\]>/g, '');
    if (!code?.trim()) {
      console.error('[BaekjoonHub] SWEA 코드 상세 응답 구조', {
        title: detailDoc.title,
        hasCodeWrap: !!codeWrap,
        children: [...(codeWrap?.children || [])].map((el) => ({ tag: el.tagName, className: el.className, id: el.id, textLength: el.textContent?.length })),
      });
      throw new Error('코드 원문을 찾지 못했습니다.');
    }
    const info = [...card.querySelectorAll('.info li')].map((li) => li.querySelector('span')?.textContent?.trim() || '');
    const [languageRaw, memory, runtime, length] = info;
    if (!languageRaw) throw new Error('제출 언어를 찾지 못했습니다.');
    const language = languageRaw === languageRaw.toUpperCase()
      ? languageRaw.substring(0, 1) + languageRaw.substring(1).toLowerCase() : languageRaw;
    const extension = resolveLanguageExtension(languages, languageRaw);
    const link = `${location.origin}/main/code/problem/problemDetail.do?contestProbId=${encodeURIComponent(contestProbId)}`;
    return await makeDataForBulkUploadSWEA({
      link, problemId, level, title, extension, code, runtime, memory, length, language,
    });
  } catch (error) {
    console.error(`[BaekjoonHub] SWEA ${problemId} 코드 조회 실패`, error);
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
