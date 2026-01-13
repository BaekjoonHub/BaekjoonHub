/**
 * GitHub API type definitions
 */

// GitHub reference
export interface GitHubReference {
  refSHA: string | null;
  ref: string | null;
}

// GitHub blob/tree item
export interface GitHubTreeItem {
  path: string;
  sha: string;
  mode: string;
  type: string;
}

// GitHub repository info
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
  };
}

// GitHub commit info
export interface GitHubCommit {
  sha: string;
  message: string;
  tree: {
    sha: string;
  };
  parents: Array<{
    sha: string;
  }>;
}

// GitHub file content response
export interface GitHubFileContent {
  content?: {
    sha: string;
    path: string;
    name: string;
    size: number;
  };
  commit?: {
    sha: string;
    message: string;
  };
}

// GitHub tree response
export interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeItem[];
  truncated?: boolean;
}

// GitHub API error response
export interface GitHubApiError {
  message: string;
  documentation_url?: string;
  status?: string;
}

// GitHub class interface
export interface IGitHub {
  hook: string;
  token: string;

  update(hook: string, token: string): void;
  getReference(branch?: string): Promise<GitHubReference>;
  getDefaultBranchOnRepo(): Promise<string>;
  createBlob(content: string, path: string): Promise<GitHubTreeItem>;
  createTree(refSHA: string, treeItems: GitHubTreeItem[]): Promise<string>;
  createCommit(message: string, treeSHA: string, refSHA: string): Promise<string>;
  updateHead(ref: string, commitSHA: string): Promise<string>;
  createOrUpdateFile(path: string, message: string, content: string, branch?: string | null): Promise<GitHubFileContent>;
  initializeEmptyRepository(branch?: string): Promise<GitHubFileContent>;
  getTree(): Promise<GitHubTreeItem[]>;
}
