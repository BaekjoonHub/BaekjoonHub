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
