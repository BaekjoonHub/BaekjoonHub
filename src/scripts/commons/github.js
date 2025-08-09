import { b64EncodeUnicode } from "./util.js";
import urls from "@/constants/url.js";
import log from "@/commons/logger.js";

/** get a repo default branch
 * @see https://docs.github.com/en/rest/reference/repos
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @return {Promise} - the promise for the branch sha
 */
export async function getDefaultBranchOnRepo(hook, token) {
  log.info("getDefaultBranchOnRepo called with hook:", hook);
  return fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}`, {
    method: "GET",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  })
    .then((res) => {
      log.debug("getDefaultBranchOnRepo response:", res);
      return res.json();
    })
    .then((data) => {
      log.debug("getDefaultBranchOnRepo data:", data);
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
export async function getReference(hook, token, branch) {
  log.info("getReference called with hook:", hook, "branch:", branch);
  const defaultBranch = branch || (await getDefaultBranchOnRepo(hook, token));
  log.debug("getReference - defaultBranch:", defaultBranch);
  // return fetch(`https://api.github.com/repos/${hook}/git/refs`, {
  return fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/refs/heads/${defaultBranch}`, {
    method: "GET",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  })
    .then((res) => {
      log.debug("getReference response:", res);
      return res.json();
    })
    .then((data) => {
      log.debug("getReference data:", data);
      // 빈 저장소 처리: API가 409 오류를 반환하거나 object가 없는 경우
      if (data.status === "409" || data.message === "Git Repository is empty." || !data.object) {
        log.info("Empty repository detected, returning null for initial commit");
        return { refSHA: null, ref: null };
      }
      return { refSHA: data.object.sha, ref: data.ref };
    });
}

/** create or update file using Contents API (works for empty repositories)
 * @see https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
 * @param {string} hook - github repository
 * @param {string} token - github access token
 * @param {string} path - file path
 * @param {string} message - commit message
 * @param {string} content - file content
 * @param {string} branch - branch name (optional)
 * @return {Promise} - the promise for the file creation
 */
export async function createOrUpdateFile(hook, token, path, message, content, branch = null) {
  log.info("createOrUpdateFile called with hook:", hook, "path:", path);
  
  const body = {
    message: message,
    content: b64EncodeUnicode(content),
  };
  
  if (branch) {
    body.branch = branch;
  }
  
  return fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
    .then((res) => {
      log.debug("createOrUpdateFile response:", res);
      return res.json();
    })
    .then((data) => {
      log.debug("createOrUpdateFile data:", data);
      return data;
    });
}

/** Initialize empty repository with README.md
 * @param {string} hook - github repository
 * @param {string} token - github access token
 * @param {string} branch - branch name
 * @return {Promise} - the promise for the initialization
 */
export async function initializeEmptyRepository(hook, token, branch = "master") {
  log.info("initializeEmptyRepository called with hook:", hook, "branch:", branch);
  
  // 저장소 이름 추출 (hook에서 "owner/repo" 형태)
  const repoName = hook.split('/')[1] || 'TIL';
  
  // 루트에 초기 README.md 생성하여 저장소 초기화
  const initialReadmeContent = `# ${repoName}\nThis is a auto push repository for Baekjoon Online Judge created with [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub).`;
  
  return createOrUpdateFile(hook, token, "README.md", "Initial commit", initialReadmeContent, branch);
}

/** create a Blob
 * @see https://docs.github.com/en/rest/reference/git#create-a-blob
 * @param {string} hook - github repository
 * @param {string} token - github token
 * @param {string} content - the content on base64 to add the repository
 * @param {string} path - the path to add the repository
 * @return {Promise} - the promise for the tree_item object
 */
export async function createBlob(hook, token, content, path) {
  log.info("createBlob called with hook:", hook, "path:", path);
  return fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({
      content: b64EncodeUnicode(content),
      encoding: "base64",
    }),
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "content-type": "application/json",
    },
  })
    .then((res) => {
      log.debug("createBlob response:", res);
      return res.json();
    })
    .then((data) => {
      log.debug("createBlob data:", data);
      return {
        path,
        sha: data.sha,
        mode: "100644",
        type: "blob",
      };
    });
}

/** create a new tree in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @param {object} treeItems - the tree items
 * @param {string} refSHA - the root sha of the tree
 * @return {Promise} - the promise for the tree sha
 */
export async function createTree(hook, token, refSHA, treeItems) {
  log.info("createTree called with hook:", hook, "refSHA:", refSHA);
  return fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ tree: treeItems, base_tree: refSHA }),
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "content-type": "application/json",
    },
  })
    .then((res) => {
      log.debug("createTree response:", res);
      return res.json();
    })
    .then((data) => {
      log.debug("createTree data:", data);
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
export async function createCommit(hook, token, message, treeSHA, refSHA) {
  log.info("createCommit called with hook:", hook, "message:", message);
  return fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: treeSHA, parents: [refSHA] }),
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "content-type": "application/json",
    },
  })
    .then((res) => {
      log.debug("createCommit response:", res);
      return res.json();
    })
    .then((data) => {
      log.debug("createCommit data:", data);
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
export async function updateHead(hook, token, ref, commitSHA, force = true) {
  log.info("updateHead called with hook:", hook, "ref:", ref, "commitSHA:", commitSHA);
  return fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/${ref}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commitSHA, force }),
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "content-type": "application/json",
    },
  })
    .then((res) => {
      log.debug("updateHead response:", res);
      return res.json();
    })
    .then((data) => {
      log.debug("updateHead data:", data);
      return data.sha;
    });
}

/** get a tree recursively
 * @see https://docs.github.com/en/rest/reference/git#get-a-tree
 * @param {string} hook - the github repository
 * @param {string} token - the github token
 * @return {Promise} - the promise for the tree items
 */
export async function getTree(hook, token) {
  log.info("getTree called with hook:", hook);
  return fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/trees/HEAD?recursive=1`, {
    method: "GET",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  })
    .then((res) => {
      log.debug("getTree response:", res);
      return res.json();
    })
    .then((data) => {
      log.debug("getTree data:", data);
      // GitHub API 에러 응답인 경우 빈 배열 반환
      if (data.message || !data.tree) {
        log.warn("getTree error or empty response:", data);
        return [];
      }
      return data.tree;
    })
    .catch((error) => {
      log.error("getTree fetch error:", error);
      return [];
    });
}

export class GitHub {
  constructor(hook, token) {
    log.debug("GitHub constructor", hook, token);
    this.update(hook, token);
  }

  update(hook, token) {
    this.hook = hook;
    this.token = token;
  }

  async getReference(branch) {
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

  async createTree(refSHA, treeItems) {
    // hook, token, baseSHA, tree_items
    log.debug("GitHub createTree", "refSHA:", refSHA, "tree_items:", treeItems);
    return createTree(this.hook, this.token, refSHA, treeItems);
  }

  async createCommit(message, treeSHA, refSHA) {
    // hook, token, message, tree, parent
    log.debug("GitHub createCommit", "message:", message, "treeSHA:", treeSHA, "refSHA:", refSHA);
    return createCommit(this.hook, this.token, message, treeSHA, refSHA);
  }

  async updateHead(ref, commitSHA) {
    // hook, token, commitSHA, force = true)
    log.debug("GitHub updateHead", "ref:", ref, "commitSHA:", commitSHA);
    return updateHead(this.hook, this.token, ref, commitSHA, true);
  }

  async createOrUpdateFile(path, message, content, branch = null) {
    log.debug("GitHub createOrUpdateFile", "path:", path, "message:", message);
    return createOrUpdateFile(this.hook, this.token, path, message, content, branch);
  }

  async initializeEmptyRepository(branch = "master") {
    log.debug("GitHub initializeEmptyRepository", "branch:", branch);
    return initializeEmptyRepository(this.hook, this.token, branch);
  }

  async getTree() {
    // hook, token
    return getTree(this.hook, this.token);
  }
}
