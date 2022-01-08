/* Github 업로드 메인 함수 */
/* 모든 업로드는 uploadGit 함수로 합니다.  파라미터는 아래와 같습니다. */
/*  
    code: 업로드하는 파일 내용
    problemName: 업로드하는 파일의 디렉토리
    fileName: 업로드하는 파일 명
    type: CommitType의 readme or code
    cb: Callback 함수(업로드 후 로딩 아이콘 처리를 맡는다
*/
async function uploadGit(code, directory, fileName, type, cb = undefined, bojData) {
  /* Get necessary payload data */
  const token = await getToken();
  if (debug) console.log('token', token);
  const mode = await getModeType();
  if (mode === 'commit') {
    /* Local Storage에 저장된 Github Repository(hook) 주소를 찾습니다 */
    const hook = await getHook();

    /* 현재 업로드되어 있는 코드가 있다면 해당 코드의 SHA를 구합니다. */
    const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
    const stats = await getStats();

    let sha = null;
    if (stats !== undefined && stats.submission !== undefined && stats.submission[filePath] !== undefined) {
      sha = stats.submission[filePath][type];
    }

    return upload(token, hook, code, directory, fileName, type, sha, cb, bojData);
  }
}

/* Github 업로드 함수 */
/* Github api를 사용하여 업로드를 합니다. 참고 링크 https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents */
/* 함수 파라미터는 아래와 같습니다.
    token: local storage에 있는 Github Token
    hook: 등록된 Github Repository
    code: Github에 푸시할 파일 내용
    directory: 업로드할 파일 디렉토리
    filename: 업로드할 파일명
    type: CommitType의 readme or code
    sha: 현재 업로드된 파일의 SHA
    cb: Callback 함수(업로드 후 로딩 아이콘 처리를 맡는다
*/
function upload(token, hook, code, directory, filename, type, sha, cb = undefined, bojData) {
  // To validate user, load user object from GitHub.

  return fetch(`https://api.github.com/repos/${hook}/contents/${directory}/${filename}`, {
    method: 'PUT',
    body: JSON.stringify({ message: bojData.meta.message, content: code, sha }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      if (debug && type === CommitType.readme) console.log('data', data);
      if (data != null && (data !== data.content) != null && data.content.sha != null && data.content.sha !== undefined) {
        const { sha } = data.content; // get updated SHA
        getStats().then((stats) => {
          /* Local Storage에 Stats Object가 없다면 초기화한다. */
          if (stats === null || stats === {} || stats === undefined) {
            // create stats object
            stats = {};
            stats.version = '1.0.2';
            stats.submission = {};
          }
          const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
          const { submissionId } = bojData.submission;

          if (isNull(stats.submission[filePath])) {
            stats.submission[filePath] = {};
          }

          stats.submission[filePath].submissionId = submissionId;
          stats.submission[filePath][type] = sha; // update sha key.
          saveStats(stats).then(() => {
            if (debug) console.log(`Successfully committed ${filename} to github`);
            if (cb !== undefined) cb();
          });
        });
      }
    });
}

class GitHub {
  constructor(username, hook, token) {
    this.update(username, hook, token);
  }

  update(username, hook, token) {
    this.username = username;
    this.hook = hook;
    this.token = token;
  }

  async createReference() {
    // username, hook, token
    return createReference(this.username, this.hook, this.token);
  }

  async createBlob(content, path) {
    // username, hook, token, content, path
    return createBlob(this.username, this.hook, this.token, content, path);
  }

  async createTree(refSHA, tree_items) {
    // username, hook, token, baseSHA, tree_items
    return createTree(this.username, this.hook, this.token, refSHA, tree_items);
  }

  async createCommit(message, treeSHA, refSHA) {
    // username, hook, token, message, tree, parent
    return createCommit(this.username, this.hook, this.token, message, treeSHA, refSHA);
  }

  async updateHead(commitSHA) {
    // username, hook, token, commitSHA, force = true)
    return updateHead(this.username, this.hook, this.token, commitSHA, true);
  }
}

/** Create a reference
 * @param {string} username - github username
 * @param {string} hook - github repository
 * @param {string} token - reference name
 * @return {Promise} - the promise for the reference sha
 */
async function createReference(username, hook, token) {
  return fetch(`https://api.github.com/repos/${username}/${hook}/git/refs`, {
    method: 'POST',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json()[0])
    .then((data) => data.object.sha);
}
/** create a Blob
 * @param {string} username - github username
 * @param {string} hook - github repository
 * @param {string} token - github token
 * @param {string} content - the content on base64 to add the repository
 * @param {string} path - the path to add the repository
 * @return {Promise} - the promise for the tree_item object
 */
async function createBlob(username, hook, token, content, path) {
  return fetch(`https://api.github.com/repos/${username}/${hook}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: b64EncodeUnicode(content), encoding: 'base64' }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return { path, sha: data.sha, mode: '100644', type: 'blob' };
    });
}

/** create a new tree in git
 * @param {string} username - the github username
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {object} tree_items - the tree items
 * @param {string} refSHA - the root sha of the tree
 * @return {Promise} - the promise for the tree sha
 */
async function createTree(username, hook, token, refSHA, tree_items) {
  return fetch(`https://api.github.com/repos/${username}/${hook}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree: tree_items, base_tree: refSHA }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.sha;
    });
}

/** create a commit in git
 * @param {string} username - the github username
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} message - the commit message
 * @param {string} treeSHA - the tree sha
 * @param {string} refSHA - the parent sha
 * @return {Promise} - the promise for the commit sha
 */
async function createCommit(username, hook, token, message, treeSHA, refSHA) {
  return fetch(`https://api.github.com/repos/${username}/${hook}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSHA, parents: [refSHA] }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.sha;
    });
}

/** update a ref
 * @param {string} username - the github username
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} commitSHA - the commit sha
 * @param {boolean} force - force update
 * @return {Promise} - the promise for the http request
 */
async function updateHead(username, hook, token, commitSHA, force = true) {
  return fetch(`https://api.github.com/repos/${username}/${hook}/git/refs`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSHA, force }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.sha;
    });
}
