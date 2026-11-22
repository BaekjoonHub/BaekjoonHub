/*
  DOJ 의 제출을 읽어 업로드할 데이터로 만드는 함수의 모음입니다.
  채점 결과·언어·시간·메모리는 내 제출 목록(/api/my-submissions)에서, 제목과 난이도는 공개 API(/api/v1)에서 받고,
  코드만 제출 상세 페이지의 HTML 에서 읽습니다. 코드는 어느 API 도 주지 않기 때문입니다.
*/

/**
 * 내 제출 목록의 항목이 올릴 풀이인지 봅니다: 만점 정답이고, 대회·DLC 제출이 아니고, 최근에 낸 것.
 * 대회 중에는 코드를 공유할 수 없고(이용약관 4), DLC 는 공개한 코드를 스포일러로 가리라고 한다(DLC 이용 규칙).
 * 최근 것만 보는 것은 내 제출 목록을 열 때마다 예전 풀이까지 올리지 않기 위해서다.
 * @param {object} submission - /api/my-submissions 의 submissions 항목
 * @param {number} now - 지금 시각 (ms)
 * @returns {boolean}
 */
function isUploadable(submission, now) {
  return (
    submission.verdict === 'ACCEPTED' &&
    isNull(submission.contestSlug) &&
    isNull(submission.contestTitle) &&
    isNull(submission.dlcVariantId) &&
    isNull(submission.dlcSlug) &&
    submission.canViewDetail !== false &&
    isFresh(submission, now)
  );
}

/** 최근(DOJ_FRESH_MS 안)에 낸 제출인지 봅니다. */
function isFresh(submission, now) {
  return now - Date.parse(submission.createdAt) < DOJ_FRESH_MS;
}

/**
 * 내 제출 목록에서 올릴 제출을 고릅니다.
 * 같은 문제의 맞은 제출이 여럿이면 가장 최근 것만 고른다. 차례로 다 올리면 예전 풀이가 최근 풀이를 덮을 수 있다.
 * @param {Array<object>} submissions - /api/my-submissions 의 submissions
 * @param {number} now - 지금 시각 (ms)
 * @returns {Array<object>}
 */
function pickUploads(submissions, now) {
  const newest = new Map(); // 문제 번호 → 제출
  for (const submission of submissions) {
    if (!isUploadable(submission, now)) continue;
    const picked = newest.get(submission.problemDisplayId);
    if (isNull(picked) || Date.parse(submission.createdAt) > Date.parse(picked.createdAt)) newest.set(submission.problemDisplayId, submission);
  }
  return [...newest.values()];
}

/**
 * Next.js 가 페이지 HTML 에 실어 보내는 데이터(React Flight)를 행 단위로 읽습니다.
 * HTML 에는 <script>self.__next_f.push([1, "글"])</script> 조각으로 나뉘어 실려 있고(UTF-8 글로 풀 수 없는 조각은 [3, base64]),
 * 이어 붙이면 "행 번호:JSON\n" 행과 "행 번호:T바이트 수(16진),글" 행이 된다. 1024자 이상인 문자열은 T 행으로 빠지고
 * 원래 자리에는 "$행 번호" 가 남는다. (react-server 의 ReactFlightServer.js, next 의 app-render/use-flight-response.tsx)
 * shortcut: 길이를 앞에 적는 행 가운데 T(글)만 읽는다. 다른 이진 행(typed array)이 실린 페이지는 그 뒤 행을 잘못 나눠 코드를 찾지 못한다. 그런 페이지가 나오면 그 행도 길이대로 건너뛴다.
 * @param {string} html - 페이지 HTML
 * @returns {{models: Array, texts: Map<string, string>}} JSON 행의 값들과, T 행의 글(행 번호 → 글)
 */
function readFlight(html) {
  const chunks = [];
  for (const match of html.matchAll(/<script[^>]*>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try {
      const [kind, data] = JSON.parse(match[1]);
      if (kind === 1) chunks.push(new TextEncoder().encode(data));
      else if (kind === 3) chunks.push(Uint8Array.from(atob(data), (char) => char.charCodeAt(0)));
    } catch (error) {
      /* 데이터 조각이 아닌 스크립트 */
    }
  }
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  const decoder = new TextDecoder();
  const models = [];
  const texts = new Map();
  let i = 0;
  while (i < bytes.length) {
    const colon = bytes.indexOf(0x3a, i); // ':'
    if (colon < 0) break;
    const id = decoder.decode(bytes.subarray(i, colon));
    if (bytes[colon + 1] === 0x54) {
      // 'T': 글의 길이는 글자 수가 아니라 바이트 수다
      const comma = bytes.indexOf(0x2c, colon); // ','
      const length = parseInt(decoder.decode(bytes.subarray(colon + 2, comma)), 16);
      if (comma < 0 || Number.isNaN(length)) break;
      texts.set(id, decoder.decode(bytes.subarray(comma + 1, comma + 1 + length)));
      i = comma + 1 + length;
    } else {
      const newline = bytes.indexOf(0x0a, colon);
      const end = newline < 0 ? bytes.length : newline;
      try {
        models.push(JSON.parse(decoder.decode(bytes.subarray(colon + 1, end))));
      } catch (error) {
        /* 모듈 참조(I[…])나 힌트(HL[…]) 행 */
      }
      i = end + 1;
    }
  }
  return { models, texts };
}

/**
 * 읽은 데이터에서 코드 보기 컴포넌트의 속성 { value: 코드, language, …, expandLabel } 을 찾습니다.
 * 화면 글자(label 의 '제출 코드' 등)는 표시 언어에 따라 바뀌므로 속성 이름으로 찾는다.
 * @param {any} node
 * @returns {(object|undefined)}
 */
function findCodeViewer(node) {
  if (isNull(node) || typeof node !== 'object') return undefined;
  if (typeof node.value === 'string' && typeof node.language === 'string' && 'expandLabel' in node) return node;
  for (const child of Object.values(node)) {
    const found = findCodeViewer(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * 제출 상세 페이지의 HTML 에서 제출한 코드를 찾습니다. (페이지에 코드가 실린 모양은 2026-11-22 에 확인했다)
 * @param {string} html - /<언어>/submissions/<제출 id> 의 HTML
 * @returns {(string|null)} 찾지 못하면 null
 */
function findDojCode(html) {
  const { models, texts } = readFlight(html);
  const value = findCodeViewer(models)?.value;
  if (isNull(value)) return null;
  /* '$' 로 시작하는 글은 '$$…' 로 실리고, '$행 번호' 는 T 행의 글을 가리킨다 */
  if (value.startsWith('$$')) return value.slice(1);
  if (value.startsWith('$')) return texts.get(value.slice(1)) ?? null;
  return value;
}

/**
 * 제출 하나를 업로드할 데이터로 만듭니다.
 * README 에 문제 본문은 싣지 않는다. 지문의 권리는 작성자에게 있고(이용약관 11), 공개 API 도 지문은 주지 않는다.
 * @param {object} submission - /api/my-submissions 의 submissions 항목
 * @param {object} problem - /api/v1/problems/<번호> 의 problem
 * @param {string} code - 제출한 코드
 * @returns {Promise<{problemId, directory, message, fileName, readme, code}>}
 */
async function makeData(submission, problem, code) {
  const problemId = `${submission.problemDisplayId}`;
  /* 제목은 화면 표시 언어와 상관없이 한국어 → 영어 → 그 밖의 순으로 고른다 (표시 언어를 바꿔도 같은 폴더에 올라가도록) */
  const title = problem.titles?.ko ?? problem.titles?.en ?? Object.values(problem.titles ?? {})[0] ?? submission.problemTitle;
  const safeTitle = convertSingleCharToDoubleChar(title);
  const [language, extension] = dojLanguage(submission.language);
  const levelFull = tierName(problem.difficulty); // 0 = Unrated, -1 = Not Ratable 도 'Unrated' 다
  const level = levelFull.split(' ')[0];
  const time = submission.maxExecutionTimeMs ?? 0;
  const memory = Math.round((submission.maxMemoryBytes ?? 0) / 1024);
  const directory = await buildDirectory('doj', {
    platform: 'DOJ',
    level,
    levelFull,
    id: problemId,
    title: safeTitle,
    language,
    _defaultDir: `DOJ/${level}/${problemId}. ${safeTitle}`,
  });
  const message = `[${levelFull}] Title: ${title}, Time: ${time} ms, Memory: ${memory} KB -BaekjoonHub`;
  const fileName = `${safeTitle}.${extension}`;
  // prettier-ignore
  const readme =
    `# [${levelFull}] ${title} - ${problemId} \n\n`
    + `[문제 링크](https://doj.kr/ko/problems/${problemId}) \n\n`
    + `### 성능 요약\n\n메모리: ${memory} KB, 시간: ${time} ms\n\n`
    + `### 제출 일자\n\n${getDateString(new Date(submission.createdAt))}\n\n`
    + `> 출처: DOJ, https://doj.kr/`;
  return { problemId, directory, message, fileName, readme, code };
}
