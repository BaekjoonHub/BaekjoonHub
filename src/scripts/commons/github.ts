/**
 * GitHub API wrapper for BaekjoonHub
 * Handles Git operations for syncing code to GitHub repositories
 */

import { b64EncodeUnicode } from "./util";
import urls from "@/constants/url";
import log from "@/commons/logger";
import type {
  GitHubReference,
  GitHubTreeItem,
  GitHubRepository,
  GitHubFileContent,
  IGitHub,
} from "@/types/github";

// Authorization header helper
function getAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

/**
 * Get a repo's default branch
 * @see https://docs.github.com/en/rest/reference/repos
 */
export async function getDefaultBranchOnRepo(hook: string, token: string): Promise<string> {
  log.info("getDefaultBranchOnRepo called with hook:", hook);
  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}`, {
    method: "GET",
    headers: getAuthHeaders(token),
  });
  log.debug("getDefaultBranchOnRepo response:", response);
  const data = (await response.json()) as GitHubRepository;
  log.debug("getDefaultBranchOnRepo data:", data);
  return data.default_branch;
}

/**
 * Get a reference (branch ref and SHA)
 * @see https://docs.github.com/en/rest/reference/git#get-a-reference
 */
export async function getReference(
  hook: string,
  token: string,
  branch?: string
): Promise<GitHubReference> {
  log.info("getReference called with hook:", hook, "branch:", branch);
  const defaultBranch = branch || (await getDefaultBranchOnRepo(hook, token));
  log.debug("getReference - defaultBranch:", defaultBranch);

  const response = await fetch(
    `${urls.GITHUB_API_REPOS_URL}/${hook}/git/refs/heads/${defaultBranch}`,
    {
      method: "GET",
      headers: getAuthHeaders(token),
    }
  );
  log.debug("getReference response:", response);

  interface RefResponse {
    status?: string;
    message?: string;
    object?: {
      sha: string;
    };
    ref?: string;
  }

  const data = (await response.json()) as RefResponse;
  log.debug("getReference data:", data);

  // Handle empty repository: API returns 409 or object is missing
  if (data.status === "409" || data.message === "Git Repository is empty." || !data.object) {
    log.info("Empty repository detected, returning null for initial commit");
    return { refSHA: null, ref: null };
  }

  return { refSHA: data.object.sha, ref: data.ref ?? null };
}

/**
 * Create or update file using Contents API (works for empty repositories)
 * @see https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
 */
export async function createOrUpdateFile(
  hook: string,
  token: string,
  path: string,
  message: string,
  content: string,
  branch: string | null = null
): Promise<GitHubFileContent> {
  log.info("createOrUpdateFile called with hook:", hook, "path:", path);

  const body: Record<string, string> = {
    message,
    content: b64EncodeUnicode(content),
  };

  if (branch) {
    body.branch = branch;
  }

  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/contents/${path}`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  log.debug("createOrUpdateFile response:", response);
  const data = (await response.json()) as GitHubFileContent;
  log.debug("createOrUpdateFile data:", data);
  return data;
}

/**
 * Initialize empty repository with README.md
 */
export async function initializeEmptyRepository(
  hook: string,
  token: string,
  branch = "master"
): Promise<GitHubFileContent> {
  log.info("initializeEmptyRepository called with hook:", hook, "branch:", branch);

  // Extract repository name from hook (format: "owner/repo")
  const repoName = hook.split("/")[1] || "TIL";

  // Create initial README.md at root to initialize repository
  const initialReadmeContent = `# ${repoName}\nThis is a auto push repository for Baekjoon Online Judge created with [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub).`;

  return createOrUpdateFile(hook, token, "README.md", "Initial commit", initialReadmeContent, branch);
}

/**
 * Create a Blob
 * @see https://docs.github.com/en/rest/reference/git#create-a-blob
 */
export async function createBlob(
  hook: string,
  token: string,
  content: string,
  path: string
): Promise<GitHubTreeItem> {
  log.info("createBlob called with hook:", hook, "path:", path);

  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({
      content: b64EncodeUnicode(content),
      encoding: "base64",
    }),
    headers: {
      ...getAuthHeaders(token),
      "Content-Type": "application/json",
    },
  });
  log.debug("createBlob response:", response);

  interface BlobResponse {
    sha: string;
  }

  const data = (await response.json()) as BlobResponse;
  log.debug("createBlob data:", data);

  return {
    path,
    sha: data.sha,
    mode: "100644",
    type: "blob",
  };
}

/**
 * Create a new tree in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-tree
 */
export async function createTree(
  hook: string,
  token: string,
  refSHA: string,
  treeItems: GitHubTreeItem[]
): Promise<string> {
  log.info("createTree called with hook:", hook, "refSHA:", refSHA);

  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ tree: treeItems, base_tree: refSHA }),
    headers: {
      ...getAuthHeaders(token),
      "Content-Type": "application/json",
    },
  });
  log.debug("createTree response:", response);

  interface TreeResponse {
    sha: string;
  }

  const data = (await response.json()) as TreeResponse;
  log.debug("createTree data:", data);

  return data.sha;
}

/**
 * Create a commit in git
 * @see https://docs.github.com/en/rest/reference/git#create-a-commit
 */
export async function createCommit(
  hook: string,
  token: string,
  message: string,
  treeSHA: string,
  refSHA: string
): Promise<string> {
  log.info("createCommit called with hook:", hook, "message:", message);

  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: treeSHA, parents: [refSHA] }),
    headers: {
      ...getAuthHeaders(token),
      "Content-Type": "application/json",
    },
  });
  log.debug("createCommit response:", response);

  interface CommitResponse {
    sha: string;
  }

  const data = (await response.json()) as CommitResponse;
  log.debug("createCommit data:", data);

  return data.sha;
}

/**
 * Update a ref
 * @see https://docs.github.com/en/rest/reference/git#update-a-reference
 */
export async function updateHead(
  hook: string,
  token: string,
  ref: string,
  commitSHA: string,
  force = true
): Promise<string> {
  log.info("updateHead called with hook:", hook, "ref:", ref, "commitSHA:", commitSHA);

  const response = await fetch(`${urls.GITHUB_API_REPOS_URL}/${hook}/git/${ref}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commitSHA, force }),
    headers: {
      ...getAuthHeaders(token),
      "Content-Type": "application/json",
    },
  });
  log.debug("updateHead response:", response);

  interface UpdateHeadResponse {
    sha: string;
  }

  const data = (await response.json()) as UpdateHeadResponse;
  log.debug("updateHead data:", data);

  return data.sha;
}

/**
 * Get a tree recursively
 * @see https://docs.github.com/en/rest/reference/git#get-a-tree
 */
export async function getTree(hook: string, token: string): Promise<GitHubTreeItem[]> {
  log.info("getTree called with hook:", hook);

  try {
    const response = await fetch(
      `${urls.GITHUB_API_REPOS_URL}/${hook}/git/trees/HEAD?recursive=1`,
      {
        method: "GET",
        headers: getAuthHeaders(token),
      }
    );
    log.debug("getTree response:", response);

    interface TreeResponse {
      message?: string;
      tree?: GitHubTreeItem[];
    }

    const data = (await response.json()) as TreeResponse;
    log.debug("getTree data:", data);

    // Handle GitHub API error response
    if (data.message || !data.tree) {
      log.warn("getTree error or empty response:", data);
      return [];
    }

    return data.tree;
  } catch (error) {
    log.error("getTree fetch error:", error);
    return [];
  }
}

/**
 * GitHub class for managing repository operations
 */
export class GitHub implements IGitHub {
  public hook: string;
  public token: string;

  constructor(hook: string, token: string) {
    log.debug("GitHub constructor", hook, token);
    this.hook = hook;
    this.token = token;
  }

  update(hook: string, token: string): void {
    this.hook = hook;
    this.token = token;
  }

  async getReference(branch?: string): Promise<GitHubReference> {
    return getReference(this.hook, this.token, branch);
  }

  async getDefaultBranchOnRepo(): Promise<string> {
    return getDefaultBranchOnRepo(this.hook, this.token);
  }

  async createBlob(content: string, path: string): Promise<GitHubTreeItem> {
    return createBlob(this.hook, this.token, content, path);
  }

  async createTree(refSHA: string, treeItems: GitHubTreeItem[]): Promise<string> {
    log.debug("GitHub createTree", "refSHA:", refSHA, "tree_items:", treeItems);
    return createTree(this.hook, this.token, refSHA, treeItems);
  }

  async createCommit(message: string, treeSHA: string, refSHA: string): Promise<string> {
    log.debug("GitHub createCommit", "message:", message, "treeSHA:", treeSHA, "refSHA:", refSHA);
    return createCommit(this.hook, this.token, message, treeSHA, refSHA);
  }

  async updateHead(ref: string, commitSHA: string): Promise<string> {
    log.debug("GitHub updateHead", "ref:", ref, "commitSHA:", commitSHA);
    return updateHead(this.hook, this.token, ref, commitSHA, true);
  }

  async createOrUpdateFile(
    path: string,
    message: string,
    content: string,
    branch: string | null = null
  ): Promise<GitHubFileContent> {
    log.debug("GitHub createOrUpdateFile", "path:", path, "message:", message);
    return createOrUpdateFile(this.hook, this.token, path, message, content, branch);
  }

  async initializeEmptyRepository(branch = "master"): Promise<GitHubFileContent> {
    log.debug("GitHub initializeEmptyRepository", "branch:", branch);
    return initializeEmptyRepository(this.hook, this.token, branch);
  }

  async getTree(): Promise<GitHubTreeItem[]> {
    return getTree(this.hook, this.token);
  }
}
