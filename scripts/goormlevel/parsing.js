/** NOTE
 * 문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
 * 모든 해당 파일의 모든 함수는 parseData()를 통해 호출됩니다.
 */

/* ─────────────────────────── 난이도 파싱 (#349) ───────────────────────────
 * goorm 이 난이도 뱃지 DOM 을 바꾸면서 'span[role=text] > span' 이 null 을 반환했고,
 * .innerHTML 접근이 TypeError 를 던져 parseData() 전체가 죽었다. 그 예외는 goormlevel.js 의
 * catch 로 흘러갔지만 log() 가 debug=false 때문에 no-op 이라, 업로드도 로그도 UI 표시도 없는
 * 완전한 무음 실패가 되었다.
 *
 * goorm 이 난이도 DOM 을 바꾼 건 이번이 두 번째다(#271 이 이미 '#ratingTooltipTarget > div > label'
 * 에서 'span[role=text] > span' 으로 한 번 갈아끼웠다). selector 를 세 번째로 교체하면 또 썩으므로,
 * "화면에 난이도 라벨 5종 중 하나가 텍스트로 보인다" 는 사실만 가정하는 방식으로 바꾼다.
 *
 * 핵심 불변식: 어느 경로로 찾든 difficultyLabels 의 key 와 "정확히" 일치해야만 채택한다.
 *   → 잘못된 selector 가 매칭돼도 틀린 난이도를 만들어내지 못하고 다음 후보로 넘어갈 뿐이다.
 *     실패 모드가 "오답" 이 아니라 "미검출" 로 고정된다.
 *   → 난이도는 커밋 메시지와 ${level} 커스텀 템플릿에서만 쓰이고 기본 저장 경로/dedup 키에는
 *     쓰이지 않으므로(tests/directoryTemplate.test.js), 미검출이어도 업로드는 계속하는 게 옳다.
 *
 * NOTE: 이 파일은 tests/goormDifficulty.test.js 가 Node 에서 그대로 require 한다.
 *       최상위(top-level)에 chrome.* 호출이나 DOM 접근을 추가하지 말 것.
 * ────────────────────────────────────────────────────────────────────────── */

/** 난이도를 끝내 찾지 못했을 때의 값. SWEA parsing.js 의 `|| 'Unrated'` 관례를 따른다. */
const DIFFICULTY_UNKNOWN = 'Unrated';

/** 난이도 뱃지 selector 후보(우선순위 순). 첫 번째는 기존 동작을 그대로 보존하는 무회귀 앵커다. */
const DIFFICULTY_SELECTORS = ['span[role=text] > span', 'span[role=text]', '[class*="difficulty" i]', '[data-testid*="difficulty" i]'];

/** 텍스트 스캔 대상 태그. leaf 만 검사하므로 textContent 총비용은 문서 텍스트 길이에 비례한다. */
const DIFFICULTY_SCAN_SELECTOR = 'span, em, strong, b, i, label, dt, dd, th, td, p, div, li';

/** 라벨과 같은 글자가 우연히 등장할 수 있는 영역(코드 에디터/채점 결과 표)은 스캔에서 제외한다. */
const DIFFICULTY_EXCLUDE_IDS = ['fileEditor'];
const DIFFICULTY_EXCLUDE_CLASS = /(^|\s)(cm-editor|cm-content|cm-scroller|cm-line|CodeMirror|tab-content|tab-pane)(\s|$)/;

/** 난이도 뱃지 옆에 항상 붙는 헤더 메타. 이 텍스트를 품은 "짧은" 조상이 있으면 헤더로 확정한다. */
const DIFFICULTY_CONTEXT_PATTERN = /유형|배점|참여자|정답률/;
const DIFFICULTY_CONTEXT_MAX_DEPTH = 4;
const DIFFICULTY_CONTEXT_MAX_TEXT = 200;

/**
 * 요소 또는 문자열의 텍스트를 공백 정규화해 반환합니다. null/undefined 면 빈 문자열.
 * (SWEA parsing.js 의 safeText 와 같은 역할이되, 문자열도 받도록 확장한 goorm 로컬 사본)
 * @param {Element|string|null|undefined} value
 * @returns {string}
 */
function normalizeLabelText(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : value.textContent || value.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 텍스트가 난이도 라벨 맵의 "자기 자신" 키인지 확인합니다.
 * hasOwnProperty 로 조회하는 이유: leaf 텍스트가 'constructor'/'toString' 일 때
 * 프로토타입 체인이 truthy 로 잡혀 `[난이도 function Object() {…}]` 같은 값이 나가는 것을 막는다.
 * @param {Record<string, number>} labels
 * @param {string} text
 * @returns {boolean}
 */
function isKnownDifficultyLabel(labels, text) {
  return text !== '' && labels !== null && labels !== undefined && Object.prototype.hasOwnProperty.call(labels, text);
}

/** 코드 에디터·채점 결과처럼 오검출이 날 수 있는 구역 안의 노드인지 조상을 타고 올라가며 판정합니다. */
function isInExcludedRegion(node) {
  let cur = node;
  for (let depth = 0; cur !== null && cur !== undefined && depth < 30; depth += 1) {
    if (cur.id && DIFFICULTY_EXCLUDE_IDS.indexOf(cur.id) !== -1) return true;
    const cls = typeof cur.className === 'string' ? cur.className : '';
    if (cls && DIFFICULTY_EXCLUDE_CLASS.test(cls)) return true;
    cur = cur.parentElement;
  }
  return false;
}

/**
 * 후보 노드가 문제 "헤더 행" 안에 있는지 판정합니다.
 * 조상 4단계 이내에 유형/배점/참여자/정답률 을 포함하면서 전체 텍스트가 200자 이하인 요소가 있으면 헤더로 본다.
 * 길이 상한이 핵심 판별자다 — 본문까지 삼킨 큰 컨테이너는 수천 자라 걸러지고, 헤더 행은 40자 남짓이다.
 */
function hasDifficultyContext(node) {
  let cur = node.parentElement;
  for (let depth = 0; cur !== null && cur !== undefined && depth < DIFFICULTY_CONTEXT_MAX_DEPTH; depth += 1) {
    const text = normalizeLabelText(cur);
    if (text.length <= DIFFICULTY_CONTEXT_MAX_TEXT && DIFFICULTY_CONTEXT_PATTERN.test(text)) return true;
    cur = cur.parentElement;
  }
  return false;
}

/**
 * DOM 에서 난이도 라벨 문자열('보통' 등)을 추출합니다. 찾지 못하면 빈 문자열.
 * @param {ParentNode} [root=document] - 탐색 기준 노드
 * @param {Record<string, number>} [labels=difficultyLabels] - 라벨→숫자 매핑
 * @returns {string}
 */
function parseDifficultyLabel(root, labels) {
  const scope = root || (typeof document === 'undefined' ? null : document);
  const labelMap = labels || (typeof difficultyLabels === 'undefined' ? {} : difficultyLabels);
  if (scope === null || scope === undefined) return '';

  /* 1단계: 알려진 selector 후보. querySelector(첫 매칭)가 아니라 전체를 훑고 텍스트를 검증한다.
     엉뚱한 컨테이너가 먼저 잡혀도 그 안의 진짜 뱃지를 놓치지 않기 위함이다. */
  for (const selector of DIFFICULTY_SELECTORS) {
    let candidates = [];
    try {
      candidates = [...scope.querySelectorAll(selector)];
    } catch (e) {
      continue; /* 브라우저가 해석하지 못하는 selector 문법은 건너뛴다 */
    }
    for (const candidate of candidates) {
      const text = normalizeLabelText(candidate);
      if (isKnownDifficultyLabel(labelMap, text)) return text;
    }
  }

  /* 2단계: 알려진 라벨 텍스트 스캔. goorm 의 새 class 명을 전혀 몰라도 동작하는 최후 수단. */
  let loose = '';
  let nodes = [];
  try {
    nodes = [...scope.querySelectorAll(DIFFICULTY_SCAN_SELECTOR)];
  } catch (e) {
    nodes = [];
  }
  for (const node of nodes) {
    if (node.children && node.children.length > 0) continue; /* leaf 만 검사 → textContent 비용 O(n^2) 방지 */
    const text = normalizeLabelText(node);
    if (!isKnownDifficultyLabel(labelMap, text)) continue; /* 값싼 검사를 먼저 — 조상 순회는 실제 후보(보통 0~2개)에만 돈다 */
    if (isInExcludedRegion(node)) continue;
    if (hasDifficultyContext(node)) return text; /* 헤더 문맥 확인 → 즉시 확정 */
    if (loose === '') loose = text; /* 문맥 없는 후보는 문서 순서상 첫 번째만 보류 */
  }
  if (loose !== '') console.warn(`[BaekjoonHub] 구름LEVEL 난이도를 헤더 문맥 없이 텍스트 스캔으로 찾았습니다('${loose}'). 오검출 가능성이 있어 selector 후보 갱신이 필요합니다.`);
  return loose;
}

/**
 * 난이도 숫자(1~5)를 반환합니다. 찾지 못하면 DIFFICULTY_UNKNOWN 을 반환하며, 절대 throw 하지 않습니다.
 * @param {ParentNode} [root=document]
 * @param {Record<string, number>} [labels=difficultyLabels]
 * @returns {number|string}
 */
function parseDifficulty(root, labels) {
  const labelMap = labels || (typeof difficultyLabels === 'undefined' ? {} : difficultyLabels);
  const label = parseDifficultyLabel(root, labelMap);
  if (label === '') {
    console.error(`[BaekjoonHub] 구름LEVEL 난이도를 찾지 못했습니다. goorm DOM 구조가 변경된 것으로 보입니다. '${DIFFICULTY_UNKNOWN}' 로 업로드를 계속합니다.`);
    return DIFFICULTY_UNKNOWN;
  }
  return labelMap[label];
}

/**
 * 커밋 메시지를 만듭니다. 난이도를 찾았을 때의 결과는 기존 포맷과 바이트 단위로 동일하며,
 * 못 찾은 경우에만 '[난이도 …] ' 접두사를 통째로 생략합니다.
 * ('[난이도 Unrated]' 는 진짜 goorm 등급처럼 읽혀 없는 것보다 나쁘다)
 * @returns {string}
 */
function buildGoormCommitMessage({ difficulty, title, runtime, memory }) {
  const hasDifficulty = difficulty !== DIFFICULTY_UNKNOWN && difficulty !== null && difficulty !== undefined && difficulty !== '';
  const prefix = hasDifficulty ? `[난이도 ${difficulty}] ` : '';
  return `${prefix}Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
}

/**
 *
 * @returns {ReturnType<makeData>}
 */
async function parseData() {
  const { href: link, pathname } = window.location;

  const pathnameList = pathname.split('/');

  const examId = Number(pathnameList[2]) || 0;
  const quizNumber = Number(pathnameList[5]) || 0;
  const difficulty = parseDifficulty(document);

  const titlePrefix = 'title-';
  const title = document.querySelector(`div[aria-label^="${titlePrefix}"]`).ariaLabel.replace(titlePrefix, '');

  /*프로그래밍 언어별 폴더 정리 옵션을 위한 언어 값 가져오기*/
  const currentLanguage = document.querySelector('.Tour__selectLang button').textContent.trim();

  const languageList = [...document.querySelectorAll('#FrameBody .Tour__selectLang div[role="menu"] button[role="menuitem"]')].map(($element) => $element.textContent);
  const currentLanguageIndex = languageList.findIndex((language) => currentLanguage === language);
  
  const editors = document.querySelectorAll("#fileEditor div.cm-content.cm-lineWrapping");

  // 대상 에디터 결정
  const targetIndex =
    currentLanguageIndex >= 0 && currentLanguageIndex < editors.length
      ? currentLanguageIndex
      : editors.length === 1 && currentLanguageIndex < 0
      ? 0
      : -1;

  if (targetIndex < 0) {
    /* #349: 여기서 code 가 빈 문자열이 되면 beginUpload 의 isNotEmpty 가 false 가 되어 조용히 끝난다.
       사용자에겐 파싱 실패와 구분되지 않으므로 원인을 아는 이 지점에서 남긴다. */
    console.error('[BaekjoonHub] 구름LEVEL 에디터를 찾지 못했습니다. goorm 에디터 DOM 이 변경되었을 수 있습니다.', { currentLanguage, languageList, editorCount: editors.length });
  }

  // 코드 추출
  const code =
    targetIndex >= 0
      ? Array.from(editors[targetIndex].querySelectorAll("div.cm-line"))
          .map((line) => line.textContent)
          .join("\n")
      : "";

  const $dataList = [...document.querySelectorAll('.tab-content .tab-pane.active table tbody tr')].filter(($element) => $element.childNodes[1].textContent === 'PASS');
  const { memory, runtime } = $dataList
    .map(($element) => {
      const memory = Number($element.childNodes[5].textContent.trim());
      const runtime = Number($element.childNodes[6].textContent.trim());
      return { memory, runtime };
    })
    .reduce(
      (acc, cur, index) => {
        if (index === $dataList.length - 1) {
          return {
            memory: `${((acc.memory + cur.memory) / $dataList.length / 1024).toFixed(2)} MB`,
            runtime: `${((acc.runtime + cur.runtime) / $dataList.length).toFixed(2)} ms`,
          };
        }
        return {
          memory: acc.memory + cur.memory,
          runtime: acc.runtime + cur.runtime,
        };
      },
      { memory: 0, runtime: 0 },
    );

  return makeData({
    // 문제 링크
    link,
    // 시험 uid
    examId,
    // 시험 uid와 연계된 퀴즈 uid
    quizNumber,
    // 난이도
    difficulty,
    // 제목
    title,
    // 프로그래밍 언어
    language: currentLanguage || '',
    // 코드
    code,
    // 평균 메모리 사용량
    memory,
    // 평균 실행 시간
    runtime,
  });
}

/**
 * @typedef MakeDataReturnType
 * @prop {number} examId 시험 sequence
 * @prop {number} quizNumber 퀴즈 number
 * @prop {string} directory 레포에 기록될 폴더명
 * @prop {string} message 커밋 메시지
 * @prop {string} fileName 파일명
 * @prop {string} readme README.md에 작성할 내용
 * @prop {string} code 소스코드 내용
 */

/**
 *
 * @returns {MakeDataReturnType}
 */
async function makeData({
  // 문제 링크
  link,
  // 시험 uid
  examId,
  // 시험 uid와 연계된 퀴즈 uid
  quizNumber,
  // 난이도
  difficulty,
  // 제목
  title,
  // 프로그래밍 언어
  language,
  // 코드
  code,
  // 평균 메모리 사용량
  memory,
  // 평균 실행 시간
  runtime,
}) {
  /* 구름LEVEL 은 드롭다운의 29개 언어가 전부 버전 표기('Java 14')라 맵 직접 조회가 전부 undefined 였고,
     그대로 템플릿에 박혀 `제목.undefined` 가 올라갔다. 버전을 떼고 정확히 일치할 때만 채택한다. */
  const languageExtension = resolveLanguageExtension(languages, language);
  const directory = await buildDirectory('goormlevel', {
    platform: 'goormlevel',
    level: difficulty,
    examId,
    id: quizNumber,
    title: convertSingleCharToDoubleChar(title),
    language,
    _defaultDir: `goormlevel/${examId}/${quizNumber}. ${convertSingleCharToDoubleChar(title)}`,
  });
  const message = buildGoormCommitMessage({ difficulty, title, runtime, memory });
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languageExtension}`;
  const dateInfo = getDateString(new Date(Date.now()));
  // prettier-ignore
  const readme =
    `# ${title} - ${examId}/${quizNumber} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`

  return { examId, quizNumber, directory, message, fileName, readme, code };
}

// dual-mode: 브라우저 콘텐츠 스크립트에서는 전역 함수로, Node 테스트에서는 require 로 사용
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDifficultyLabel, parseDifficulty, buildGoormCommitMessage, normalizeLabelText, isKnownDifficultyLabel, DIFFICULTY_UNKNOWN, DIFFICULTY_SELECTORS };
}
