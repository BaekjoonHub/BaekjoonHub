/**
 * Configuration constants for BaekjoonHub
 * Centralized configuration to avoid magic numbers and strings
 */

import type {
  Timeouts,
  RetryLimits,
  ResultMessages,
  GitHubApiConfig,
  LogLevels,
  FileLimits,
  Selectors,
  Defaults,
} from '@/types/config';

// Timing configurations (in milliseconds)
export const TIMEOUTS: Timeouts = {
  RETRY_DELAY: 1000,
  LOADER_INTERVAL: 2000,
  USERNAME_RETRY: 1000,
  STORAGE_BATCH_FLUSH: 100,
  API_RETRY_BASE: 1000, // Base for exponential backoff
  MAX_RETRY_WAIT: 3600000, // 1 hour max wait for rate limiting
} as const;

// Retry configurations
export const RETRY_LIMITS: RetryLimits = {
  USERNAME_MAX_RETRIES: 5,
  API_MAX_RETRIES: 3,
  SUBMISSION_CHECK_MAX: 10,
} as const;

// Success messages by platform
export const RESULT_MESSAGES: ResultMessages = {
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
    SUCCESS: "정답입니다",
    ACCEPTED: "정답",
  },
} as const;

// Platform identifiers
export const PLATFORMS = {
  BAEKJOON: "백준",
  PROGRAMMERS: "프로그래머스",
  SWEXPERTACADEMY: "SW Expert Academy",
} as const;

export type PlatformId = keyof typeof PLATFORMS;
export type PlatformName = (typeof PLATFORMS)[PlatformId];

// GitHub API configurations
export const GITHUB_API: GitHubApiConfig = {
  RATE_LIMIT_HEADER: "X-RateLimit-Remaining",
  RATE_LIMIT_RESET: "X-RateLimit-Reset",
  ACCEPT_HEADER: "application/vnd.github.v3+json",
  MAX_TREE_SIZE: 1000, // GitHub API tree size limit
} as const;

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
} as const;

// Log levels
export const LOG_LEVELS: LogLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

// File size limits
export const FILE_LIMITS: FileLimits = {
  MAX_FILE_SIZE: 1024 * 1024 * 10, // 10MB
  MAX_UPLOAD_SIZE: 1024 * 1024 * 25, // 25MB for base64
} as const;

// DOM selectors
export const SELECTORS: Selectors = {
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
} as const;

// Default values
export const DEFAULTS: Defaults = {
  BRANCH: "main",
  COMMIT_MESSAGE_PREFIX: "[",
  COMMIT_MESSAGE_SUFFIX: "]",
  README_FILENAME: "README.md",
  LOG_LEVEL: LOG_LEVELS.INFO,
} as const;
