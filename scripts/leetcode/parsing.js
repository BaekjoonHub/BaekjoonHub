/* LeetCode GraphQL 호출과 README/디렉터리 빌더 */

const LC_GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql/';

const LC_QUERY_USER_STATUS = `query globalData {
  userStatus {
    isSignedIn
    username
  }
}`;

const LC_QUERY_SUBMISSION_LIST = `query submissionList($offset: Int!, $limit: Int!, $questionSlug: String!) {
  questionSubmissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
    submissions {
      id
      statusDisplay
      lang
      runtime
      memory
      timestamp
      isPending
    }
  }
}`;

const LC_QUERY_RECENT_AC_SUBMISSIONS = `query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
  }
}`;

const LC_QUERY_SUBMISSION_DETAILS = `query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    runtime
    runtimeDisplay
    runtimePercentile
    memory
    memoryDisplay
    memoryPercentile
    code
    timestamp
    statusCode
    user { username }
    lang { name verboseName }
    question {
      questionId
      questionFrontendId
      title
      titleSlug
      difficulty
      content
      topicTags { name slug translatedName }
      exampleTestcaseList
    }
  }
}`;

async function lcGraphql(query, variables) {
  const res = await fetch(LC_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`LeetCode GraphQL ${res.status}`);
  const json = await res.json();
  if (json.errors) {
    const msg = json.errors.map((e) => e.message).join('; ');
    throw new Error(`LeetCode GraphQL: ${msg}`);
  }
  return json.data;
}

/**
 * 현재 페이지 URL에서 problem slug를 추출한다.
 * /problems/two-sum/... → 'two-sum'
 */
function getCurrentProblemSlug() {
  const m = location.pathname.match(/\/problems\/([^/]+)/);
  return m ? m[1] : null;
}

async function findUsername() {
  try {
    const data = await lcGraphql(LC_QUERY_USER_STATUS, {});
    const status = data && data.userStatus;
    if (status && status.isSignedIn) return status.username;
  } catch (e) {
    log('findUsername failed', e);
  }
  return null;
}

async function fetchLatestSubmission(slug) {
  const data = await lcGraphql(LC_QUERY_SUBMISSION_LIST, {
    offset: 0,
    limit: 1,
    questionSlug: slug,
  });
  const list = data?.questionSubmissionList?.submissions || [];
  return list[0] || null;
}

async function fetchSubmissionDetails(submissionId) {
  const id = Number(submissionId);
  const data = await lcGraphql(LC_QUERY_SUBMISSION_DETAILS, { submissionId: id });
  return data?.submissionDetails || null;
}

/**
 * submissionDetails 응답을 백준 모듈의 bojData와 동일한 모양으로 가공한다.
 * { code, readme, directory, fileName, message, samples }
 */
async function buildLeetCodeData(submissionId) {
  const detail = await fetchSubmissionDetails(submissionId);
  if (!detail) throw new Error('submissionDetails 응답이 비어 있습니다.');

  const q = detail.question || {};
  const langSlug = detail.lang?.name || '';
  const langDisplay = detail.lang?.verboseName || langSlug;
  const ext = getLeetCodeLanguageExtension(langSlug);

  const problemId = q.questionFrontendId || q.questionId || '';
  const title = q.title || `Problem ${problemId}`;
  const slug = q.titleSlug || getCurrentProblemSlug();
  const difficulty = q.difficulty || 'Unrated';
  const tags = Array.isArray(q.topicTags) ? q.topicTags.map((t) => t.name).filter(Boolean) : [];
  const samples = Array.isArray(q.exampleTestcaseList)
    ? q.exampleTestcaseList.map((s) => ({ input: s, output: '' }))
    : [];

  const safeTitle = convertSingleCharToDoubleChar(title);
  const directory = await buildDirectory('leetcode', {
    platform: 'LeetCode',
    level: difficulty,
    id: problemId,
    title: safeTitle,
    slug,
    language: langDisplay,
    _defaultDir: `LeetCode/${difficulty}/${problemId}. ${safeTitle}`,
  });

  const fileName = `${safeTitle}.${ext}`;
  const runtimeStr = detail.runtimeDisplay || (detail.runtime != null ? `${detail.runtime} ms` : '-');
  const memoryStr = detail.memoryDisplay || (detail.memory != null ? `${detail.memory}` : '-');

  const message = `[${difficulty}] Title: ${title}, Time: ${runtimeStr}, Memory: ${memoryStr} -BaekjoonHub`;

  const submittedAt = detail.timestamp
    ? new Date(Number(detail.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const readme =
    `# [${difficulty}] ${title} - ${problemId} \n\n` +
    `[문제 링크](https://leetcode.com/problems/${slug}/) \n\n` +
    `### 성능 요약\n\n` +
    `메모리: ${memoryStr}, ` +
    `시간: ${runtimeStr}\n\n` +
    `### 분류\n\n` +
    `${tags.length ? tags.join(', ') : 'Empty'}\n\n` +
    `### 제출 일자\n\n${submittedAt}\n\n` +
    (q.content
      ? `### 문제 설명\n\n${q.content}\n\n`
      : '');

  return {
    problemId,
    submissionId: String(submissionId),
    title,
    level: difficulty,
    code: detail.code || '',
    language: langDisplay,
    samples,
    directory,
    fileName,
    message,
    readme,
  };
}

/**
 * 사용자명으로 최근 Accepted 제출 목록을 가져온다 (LeetCode가 limit를 비교적 작게 캡함).
 * 같은 문제에 대해 여러 번 통과했다면 가장 최근 것 하나만 남긴다.
 */
async function fetchRecentAcSubmissions(username, limit = 50) {
  const data = await lcGraphql(LC_QUERY_RECENT_AC_SUBMISSIONS, { username, limit });
  const list = data?.recentAcSubmissionList || [];
  const seen = new Set();
  const unique = [];
  for (const item of list) {
    if (!item?.titleSlug || seen.has(item.titleSlug)) continue;
    seen.add(item.titleSlug);
    unique.push(item);
  }
  return unique;
}

/**
 * stats.submission 트리에서 이미 업로드된 LeetCode 문제 ID 집합을 추출한다.
 * 디렉터리 키의 선두 숫자(예: "1. Two Sum")를 problemId로 본다.
 * 백준 모듈의 extractUploadedProblemIds와 동일 컨셉.
 */
function extractUploadedProblemIdsForLeetCode(stats, hook) {
  const ids = new Set();
  if (isNull(stats) || isNull(stats.submission) || isNull(hook)) return ids;
  const [owner, repo] = hook.split('/');
  if (!owner || !repo) return ids;
  const root = stats.submission?.[owner]?.[repo];
  if (isNull(root)) return ids;

  const visit = (node) => {
    if (isNull(node) || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      const m = key.match(/^(\d+)/);
      if (m) ids.add(m[1]);
      visit(value);
    }
  };
  // platform 모드: <hook>/LeetCode/...
  visit(root.LeetCode);
  // language 모드: <hook>/<lang>/LeetCode/...
  for (const [k, v] of Object.entries(root)) {
    if (k === 'LeetCode' || isNull(v) || typeof v !== 'object') continue;
    visit(v.LeetCode);
  }
  return ids;
}

/**
 * LeetCode의 exampleTestcaseList는 입력 문자열만 제공하므로 input{N}.txt만 작성한다.
 * 출력이 비어있는 경우 output 파일은 생성하지 않는다.
 */
function samplesToFileEntries(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return [];
  const entries = [];
  const useNumber = samples.length > 1;
  samples.forEach((sample, idx) => {
    const suffix = useNumber ? (idx + 1) : '';
    if (sample?.input != null && sample.input !== '') {
      entries.push({ filename: `input${suffix}.txt`, content: String(sample.input) });
    }
    if (sample?.output != null && sample.output !== '') {
      entries.push({ filename: `output${suffix}.txt`, content: String(sample.output) });
    }
  });
  return entries;
}
