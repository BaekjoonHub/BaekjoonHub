class GitHub {
  constructor(hook, token) {
    if (debug) console.log('GitHub constructor', hook, token);
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
    if (debug) console.log('GitHub createTree', 'refSHA:', refSHA, 'tree_items:', tree_items);
    return createTree(this.hook, this.token, refSHA, tree_items);
  }

  async createCommit(message, treeSHA, refSHA) {
    // hook, token, message, tree, parent
    if (debug) console.log('GitHub createCommit', 'message:', message, 'treeSHA:', treeSHA, 'refSHA:', refSHA);
    return createCommit(this.hook, this.token, message, treeSHA, refSHA);
  }

  async updateHead(ref, commitSHA) {
    // hook, token, commitSHA, force = true)
    if (debug) console.log('GitHub updateHead', 'ref:', ref, 'commitSHA:', commitSHA);
    return updateHead(this.hook, this.token, ref, commitSHA, true);
  }

  async getTree() {
    // hook, token
    return getTree(this.hook, this.token);
  }
}

/** get a repo default branch
 * @see https://docs.github.com/en/rest/reference/repos
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @return {Promise} - the promise for the branch sha
 */
async function getDefaultBranchOnRepo(hook, token) {
  return fetch(`https://api.github.com/repos/${hook}`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.default_branch;
    });
}

/** get a reference
 * @see https://docs.github.com/en/rest/reference/git#get-a-reference
 * @param {string} hook - github repository
 * @param {string} token - reference name
 * @param {string} ref - reference name
 * @return {Promise} - the promise for the reference sha
 */
async function getReference(hook, token, branch = 'main') {
  // return fetch(`https://api.github.com/repos/${hook}/git/refs`, {
  return fetch(`https://api.github.com/repos/${hook}/git/refs/heads/${branch}`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return { refSHA: data.object.sha, ref: data.ref };
      // return { refSHA: data[0].object.sha, ref: data[0].ref };
    });
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
  return fetch(`https://api.github.com/repos/${hook}/git/blobs`, {
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
 * @see https://docs.github.com/en/rest/reference/git#create-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {object} tree_items - the tree items
 * @param {string} refSHA - the root sha of the tree
 * @return {Promise} - the promise for the tree sha
 */
async function createTree(hook, token, refSHA, tree_items) {
  return fetch(`https://api.github.com/repos/${hook}/git/trees`, {
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
 * @see https://docs.github.com/en/rest/reference/git#create-a-commit
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} message - the commit message
 * @param {string} treeSHA - the tree sha
 * @param {string} refSHA - the parent sha
 * @return {Promise} - the promise for the commit sha
 */
async function createCommit(hook, token, message, treeSHA, refSHA) {
  return fetch(`https://api.github.com/repos/${hook}/git/commits`, {
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
 * @see https://docs.github.com/en/rest/reference/git#update-a-reference
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {string} ref - the ref to update
 * @param {string} commitSHA - the commit sha
 * @param {boolean} force - force update
 * @return {Promise} - the promise for the http request
 */
async function updateHead(hook, token, ref, commitSHA, force = true) {
  return fetch(`https://api.github.com/repos/${hook}/git/${ref}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSHA, force }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.sha;
    });
}

/** get a tree recursively
 * @see https://docs.github.com/en/rest/reference/git#get-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @return {Promise} - the promise for the tree items
 */
async function getTree(hook, token) {
  return fetch(`https://api.github.com/repos/${hook}/git/trees/HEAD?recursive=1`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      return data.tree;
    });
}
