/**
 * Configuration type definitions for BaekjoonHub
 */

// Timing configurations (in milliseconds)
export interface Timeouts {
  readonly RETRY_DELAY: number;
  readonly LOADER_INTERVAL: number;
  readonly USERNAME_RETRY: number;
  readonly STORAGE_BATCH_FLUSH: number;
  readonly API_RETRY_BASE: number;
  readonly MAX_RETRY_WAIT: number;
}

// Retry configurations
export interface RetryLimits {
  readonly USERNAME_MAX_RETRIES: number;
  readonly API_MAX_RETRIES: number;
  readonly SUBMISSION_CHECK_MAX: number;
}

// Result messages by platform
export interface ResultMessage {
  readonly SUCCESS: string;
  readonly ACCEPTED: string;
}

export interface ResultMessages {
  readonly BAEKJOON: ResultMessage;
  readonly PROGRAMMERS: ResultMessage;
  readonly SWEXPERTACADEMY: ResultMessage;
  readonly GOORMLEVEL: ResultMessage;
}

// GitHub API configurations
export interface GitHubApiConfig {
  readonly RATE_LIMIT_HEADER: string;
  readonly RATE_LIMIT_RESET: string;
  readonly ACCEPT_HEADER: string;
  readonly MAX_TREE_SIZE: number;
}

// Log levels
export interface LogLevels {
  readonly ERROR: 0;
  readonly WARN: 1;
  readonly INFO: 2;
  readonly DEBUG: 3;
}

export type LogLevel = 0 | 1 | 2 | 3;

// File size limits
export interface FileLimits {
  readonly MAX_FILE_SIZE: number;
  readonly MAX_UPLOAD_SIZE: number;
}

// DOM selectors
export interface PlatformSelectors {
  readonly USERNAME?: string;
  readonly RESULT_TABLE?: string;
  readonly PROBLEM_TITLE?: string;
  readonly PROBLEM_NUMBER?: string;
}

export interface Selectors {
  readonly BAEKJOON: PlatformSelectors;
  readonly PROGRAMMERS: PlatformSelectors;
}

// Default values
export interface Defaults {
  readonly BRANCH: string;
  readonly COMMIT_MESSAGE_PREFIX: string;
  readonly COMMIT_MESSAGE_SUFFIX: string;
  readonly README_FILENAME: string;
  readonly LOG_LEVEL: LogLevel;
}
