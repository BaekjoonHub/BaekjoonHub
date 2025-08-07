/**
 * Configuration constants for BaekjoonHub
 * Centralized configuration to avoid magic numbers and strings
 */

// Timing configurations (in milliseconds)
export const TIMEOUTS = {
  RETRY_DELAY: 1000,
  LOADER_INTERVAL: 2000,
  USERNAME_RETRY: 1000,
  STORAGE_BATCH_FLUSH: 100,
  API_RETRY_BASE: 1000, // Base for exponential backoff
  MAX_RETRY_WAIT: 3600000, // 1 hour max wait for rate limiting
};

// Retry configurations
export const RETRY_LIMITS = {
  USERNAME_MAX_RETRIES: 5,
  API_MAX_RETRIES: 3,
  SUBMISSION_CHECK_MAX: 10,
};

// Success messages by platform
export const RESULT_MESSAGES = {
  BAEKJOON: {
    SUCCESS: "맞았습니다!!",
    ACCEPTED: "Accepted",
  },
  PROGRAMMERS: {
    SUCCESS: "정답",
    ACCEPTED: "정답입니다",
  },
  SWEXPERTACADEMY: {
    SUCCESS: "pass입니다",
    ACCEPTED: "Pass",
  },
  GOORMLEVEL: {
    SUCCESS: "통과",
    ACCEPTED: "Accepted",
  },
};

// Platform identifiers
export const PLATFORMS = {
  BAEKJOON: "백준",
  PROGRAMMERS: "프로그래머스",
  SWEXPERTACADEMY: "SW Expert Academy",
  GOORMLEVEL: "구름레벨",
};

// GitHub API configurations
export const GITHUB_API = {
  RATE_LIMIT_HEADER: "X-RateLimit-Remaining",
  RATE_LIMIT_RESET: "X-RateLimit-Reset",
  ACCEPT_HEADER: "application/vnd.github.v3+json",
  MAX_TREE_SIZE: 1000, // GitHub API tree size limit
};

// Storage keys
export const STORAGE_KEYS = {
  STATS: "stats",
  TOKEN: "bjhGitToken",
  HOOK: "bjhHook",
  USERNAME: "bjhUsername",
  MODE: "bjhMode",
  BRANCH: "bjhBranch",
  LOG_LEVEL: "bjhLogLevel",
  LANGUAGE_MAP: "bjhLanguageMap",
};

// Log levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// File size limits
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 1024 * 1024 * 10, // 10MB
  MAX_UPLOAD_SIZE: 1024 * 1024 * 25, // 25MB for base64
};

// DOM selectors
export const SELECTORS = {
  BAEKJOON: {
    USERNAME: "a.username",
    RESULT_TABLE: "#status-table tbody tr",
    PROBLEM_TITLE: ".page-header h1",
    PROBLEM_NUMBER: ".problem-label",
  },
  PROGRAMMERS: {
    RESULT_TABLE: ".result-table",
    PROBLEM_TITLE: ".challenge-title",
  },
};

// Default values
export const DEFAULTS = {
  BRANCH: "main",
  COMMIT_MESSAGE_PREFIX: "[",
  COMMIT_MESSAGE_SUFFIX: "]",
  README_FILENAME: "README.md",
  LOG_LEVEL: LOG_LEVELS.INFO,
};
