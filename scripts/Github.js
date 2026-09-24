class GitHubApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

class TokenExpiredError extends GitHubApiError {
  constructor(message, status) {
    super(message, status);
    this.name = 'TokenExpiredError';
  }
}

class GitHubTimeoutError extends GitHubApiError {
  constructor(message) {
    super(message, 0);
    this.name = 'GitHubTimeoutError';
  }
}

/* GitHub API 요청 하나에 허용하는 최대 시간(ms).
   응답 없이 멈춘 요청이 업로드를 영원히 붙잡지 않도록 끊는다. 프로그래머스·구름은 업로드를 한 줄로 세우므로
   멈춘 요청 하나가 그 탭의 이후 업로드를 모두 막는다. 트리 생성(전체 업로드는 수 MB 본문을 싣는다)과
   재귀 트리 조회(응답이 레포 크기에 비례)는 길게 둔다. */
const GITHUB_FETCH_TIMEOUT_MS = 30000;
const GITHUB_TREE_TIMEOUT_MS = 120000;
/* ref 갱신이 fast-forward 가 아니라서 거절될 때(그 사이 다른 탭·기기가 커밋함) 최신 ref 위에 다시 커밋하는
   최대 시도 횟수와, 시도 사이 대기(ms, 시도 번호만큼 늘린다) */
const GITHUB_COMMIT_MAX_ATTEMPTS = 4;
const GITHUB_COMMIT_RETRY_DELAY_MS = 500;

/**
 * GitHub API 를 호출하고 응답 본문(JSON)을 반환합니다.
 * - timeoutMs 를 넘기면 요청을 끊고 GitHubTimeoutError 를 던진다. 본문을 읽는 시간까지 포함한다.
 * - GET 은 브라우저 HTTP 캐시를 쓰지 않고 서버에 재검증한다(cache: 'no-cache').
 *   GitHub API 응답은 `Cache-Control: private, max-age=60` 이고 브라우저 캐시는 최상위 사이트별로 나뉘어 있어,
 *   다른 사이트의 탭이 ref 를 옮겨도 이 탭은 최대 60초 동안 옛 ref 를 본다. 재검증은 ETag 로 304 를 받으므로
 *   rate limit 을 쓰지 않는다.
 * @param {string} url
 * @param {RequestInit} init
 * @param {{timeoutMs?: number, notFoundAsNull?: boolean}} options - notFoundAsNull: 404 면 null 을 반환
 * @returns {Promise<any>}
 */
async function githubRequest(url, init = {}, { timeoutMs = GITHUB_FETCH_TIMEOUT_MS, notFoundAsNull = false } = {}) {
  const method = (init.method || 'GET').toUpperCase();
  const { signal, clear } = createTimeoutSignal(timeoutMs);
  const options = { ...init, signal };
  if (method === 'GET' && init.cache === undefined) options.cache = 'no-cache';
  try {
    const res = await fetch(url, options);
    if (notFoundAsNull && res.status === 404) return null;
    return await handleGitHubResponse(res);
  } catch (error) {
    if (signal.aborted && (error?.name === 'TimeoutError' || error?.name === 'AbortError')) {
      throw new GitHubTimeoutError(`GitHub API 응답이 ${Math.round(timeoutMs / 1000)}초 안에 오지 않아 요청을 중단했습니다: ${method} ${url}`);
    }
    throw error;
  } finally {
    clear();
  }
}

/**
 * timeoutMs 뒤에 abort 되는 signal 을 만듭니다.
 * AbortSignal.timeout 은 Chrome 103 부터라, 그보다 오래된 브라우저(manifest 에 최소 버전이 없다)에서는
 * AbortController 와 타이머로 대신한다. 이때는 AbortError 로 끊기며 githubRequest 가 같은 타임아웃으로 처리한다.
 * @param {number} timeoutMs
 * @returns {{signal: AbortSignal, clear: function(): void}} clear: 응답을 다 읽은 뒤 타이머를 정리한다
 */
function createTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal.timeout === 'function') return { signal: AbortSignal.timeout(timeoutMs), clear: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function handleGitHubResponse(res) {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.message || `GitHub API error: ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      throw new TokenExpiredError(message, res.status);
    }
    throw new GitHubApiError(message, res.status);
  }
  return res.json();
}

class GitHub {
  constructor(hook, token) {
    log('GitHub constructor', hook, token);
    this.update(hook, token);
  }

  update(hook, token) {
    this.hook = hook;
    this.token = token;
  }

  async getReference(branch = 'main') {
    // hook, token, branch
    return getReference(this.hook, this.token, branch);
  }

  async getDefaultBranchOnRepo() {
    return getDefaultBranchOnRepo(this.hook, this.token);
  }

  async createBlob(content, path) {
    // hook, token, content, path
    return createBlob(this.hook, this.token, content, path);
  }

  async createTree(refSHA, tree_items) {
    // hook, token, baseSHA, tree_items
    log('GitHub createTree', 'refSHA:', refSHA, 'tree_items:', tree_items);
    return createTree(this.hook, this.token, refSHA, tree_items);
  }

  async createCommit(message, treeSHA, refSHA) {
    // hook, token, message, tree, parent
    log('GitHub createCommit', 'message:', message, 'treeSHA:', treeSHA, 'refSHA:', refSHA);
    return createCommit(this.hook, this.token, message, treeSHA, refSHA);
  }

  /* force 기본값은 false 다. force 로 ref 를 옮기면 그 사이 다른 탭·기기가 올린 커밋이 브랜치 이력에서 사라진다. */
  async updateHead(ref, commitSHA, force = false) {
    // hook, token, commitSHA, force
    log('GitHub updateHead', 'ref:', ref, 'commitSHA:', commitSHA, 'force:', force);
    return updateHead(this.hook, this.token, ref, commitSHA, force);
  }

  async getTree() {
    // hook, token
    return getTree(this.hook, this.token);
  }

  async getTreeWithTruncation(ref = 'HEAD') {
    // hook, token, ref
    return getTreeWithTruncation(this.hook, this.token, ref);
  }

  /**
   * tree 항목을 브랜치 끝에 커밋합니다. ref 는 fast-forward 로만 옮긴다(force 금지).
   *
   * 업로드는 "ref 조회 → tree → commit → ref 갱신" 순서라, 그 사이 같은 브랜치에 다른 커밋이 올라가면
   * (다른 탭·다른 플랫폼·다른 기기의 업로드, 전체 업로드처럼 오래 걸리는 작업) 우리 커밋의 부모가 옛 커밋이 된다.
   * 예전처럼 force 로 옮기면 그 사이의 커밋이 브랜치 이력에서 사라졌다. 이제는 GitHub 가 갱신을 거절하므로
   * (422 Update is not a fast forward) 최신 ref 를 다시 읽어 그 위에 tree·commit 을 새로 만들고 다시 시도한다.
   * blob 은 ref 와 무관하므로 호출하는 쪽에서 한 번만 만든다.
   * @param {string} branch - 브랜치 이름 (예: 'main')
   * @param {Array<{path: string, mode: string, type: string, sha?: string, content?: string}>} treeItems
   * @param {string} message - 커밋 메시지
   * @returns {Promise<{commitSHA: string, parentSHA: string}>}
   */
  async commitTreeItems(branch, treeItems, message) {
    for (let attempt = 1; ; attempt += 1) {
      const { refSHA, ref } = await this.getReference(branch);
      const treeData = await this.createTree(refSHA, treeItems);
      const commitSHA = await this.createCommit(message, treeData.sha, refSHA);
      try {
        await this.updateHead(ref, commitSHA, false);
        return { commitSHA, parentSHA: refSHA };
      } catch (error) {
        if (!GitHub.isNotFastForwardError(error) || attempt >= GITHUB_COMMIT_MAX_ATTEMPTS) throw error;
        log('GitHub commitTreeItems: 그 사이 브랜치가 움직여 최신 ref 위에 다시 커밋합니다.', { attempt, parent: refSHA });
        await new Promise((resolve) => setTimeout(resolve, GITHUB_COMMIT_RETRY_DELAY_MS * attempt));
      }
    }
  }

  /** ref 갱신이 fast-forward 가 아니라서 거절된 오류인지 (최신 ref 위에 다시 커밋하면 되는 경합) */
  static isNotFastForwardError(error) {
    return error instanceof GitHubApiError && error.status === 422 && /fast[\s-]?forward/i.test(error.message || '');
  }
}

/** get a repo default branch
 * @see https://docs.github.com/en/rest/reference/repos
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @return {Promise} - the promise for the branch sha
 */
async function getDefaultBranchOnRepo(hook, token) {
  const data = await githubRequest(`https://api.github.com/repos/${hook}`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  });
  return data.default_branch;
}

/** get a reference
 * @see https://docs.github.com/en/rest/reference/git#get-a-reference
 * @param {string} hook - github repository
 * @param {string} token - reference name
 * @param {string} ref - reference name
 * @return {Promise} - the promise for the reference sha
 */
async function getReference(hook, token, branch = 'main') {
  /* 단수 엔드포인트(git/ref)를 쓴다. 복수(git/refs/heads/<이름>)는 정확히 일치하는 브랜치가 없으면 404 가 아니라
     이름이 그것으로 시작하는 ref 들의 배열을 200 으로 돌려줘(예: main 삭제 후 main-v2 만 남음), 없는 브랜치가
     TypeError 로 끝나 "브랜치 없음(404)" 대응을 건너뛰었다. */
  const data = await githubRequest(`https://api.github.com/repos/${hook}/git/ref/heads/${branch}`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (Array.isArray(data) || isNull(data?.object?.sha)) throw new GitHubApiError(`브랜치를 찾을 수 없습니다: ${branch}`, 404);
  return { refSHA: data.object.sha, ref: data.ref };
}
/** create a Blob
 * @see https://docs.github.com/en/rest/reference/git#create-a-blob
 * @param {string} hook - github repository
 * @param {string} token - github token
 * @param {string} content - the content on base64 to add the repository
 * @param {string} path - the path to add the repository
 * @return {Promise} - the promise for the tree_item object
 */
async function createBlob(hook, token, content, path) {
  // b64EncodeUnicode 는 UTF-8 바이트(외톨이 서러게이트는 U+FFFD)를 싣는다 — calculateBlobSHA 가 해시하는 바이트와 같다.
  const data = await githubRequest(`https://api.github.com/repos/${hook}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: b64EncodeUnicode(content), encoding: 'base64' }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  });
  return { path, sha: data.sha, mode: '100644', type: 'blob' };
}

/** create a new tree in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {object} tree_items - the tree items
 * @param {string} refSHA - the root sha of the tree
 * @return {Promise} - the promise for the tree sha
 */
async function createTree(hook, token, refSHA, tree_items) {
  /* content 를 직접 싣는 항목은 외톨이 서러게이트를 U+FFFD 로 바꿔 보낸다. 그대로 보내면 GitHub 가 '?' 로 저장해
     로컬에서 계산한 blob SHA(calculateBlobSHA, U+FFFD 기준)와 달라지고, 같은 코드도 캐시 비교에서 매번 새 코드로 보인다. */
  const tree = tree_items.map((item) => (typeof item.content === 'string' ? { ...item, content: toWellFormedText(item.content) } : item));
  return githubRequest(`https://api.github.com/repos/${hook}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree, base_tree: refSHA }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  }, { timeoutMs: GITHUB_TREE_TIMEOUT_MS });
}

/** create a commit in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-commit
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} message - the commit message
 * @param {string} treeSHA - the tree sha
 * @param {string} refSHA - the parent sha
 * @return {Promise} - the promise for the commit sha
 */
async function createCommit(hook, token, message, treeSHA, refSHA) {
  const data = await githubRequest(`https://api.github.com/repos/${hook}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSHA, parents: [refSHA] }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  });
  return data.sha;
}

/** update a ref
 * @see https://docs.github.com/en/rest/reference/git#update-a-reference
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} ref - the ref to update
 * @param {string} commitSHA - the commit sha
 * @param {boolean} force - force update
 * @return {Promise} - the promise for the http request
 */
async function updateHead(hook, token, ref, commitSHA, force = false) {
  const data = await githubRequest(`https://api.github.com/repos/${hook}/git/${ref}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSHA, force }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  });
  return data.sha;
}

/** get a tree recursively
 * @see https://docs.github.com/en/rest/reference/git#get-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @return {Promise} - the promise for the tree items
 */
async function getTree(hook, token) {
  // 재귀 트리 응답은 레포 크기에 비례해 수 MB 가 될 수 있어 트리 생성과 같은 제한 시간을 준다
  const data = await githubRequest(`https://api.github.com/repos/${hook}/git/trees/HEAD?recursive=1`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  }, { timeoutMs: GITHUB_TREE_TIMEOUT_MS });
  return data.tree;
}

/** get a tree recursively at a specific commit/ref, preserving the truncated flag.
 * recursive 응답은 10만 항목/7MB 초과 시 truncated:true 와 함께 불완전한 배열이 오므로,
 * 트리 내용을 근거로 레포에 쓰기를 수행하는 소비자(마이그레이션 등)는 이 함수를 사용해야 한다.
 * @see https://docs.github.com/en/rest/git/trees#get-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} ref - commit SHA or ref name (default: HEAD)
 * @return {Promise<{tree: Array, truncated: boolean}>}
 */
async function getTreeWithTruncation(hook, token, ref = 'HEAD') {
  const data = await githubRequest(`https://api.github.com/repos/${hook}/git/trees/${ref}?recursive=1`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  }, { timeoutMs: GITHUB_TREE_TIMEOUT_MS });
  return { tree: data.tree, truncated: data.truncated === true };
}

/** get a file from the repository
 * @see https://docs.github.com/en/rest/repos/contents#get-repository-content
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} path - the file path
 * @return {Promise} - the promise for the file object or null if not found
 */
async function getFile(hook, token, path) {
  return githubRequest(`https://api.github.com/repos/${hook}/contents/${path}`, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  }, { notFoundAsNull: true }); // 파일이 존재하지 않으면 null
}