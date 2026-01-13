/**
 * Platform-related type definitions
 */

// Platform name types
export type PlatformName = '백준' | '프로그래머스' | 'SW Expert Academy';
export type PlatformKey = 'BAEKJOON' | 'PROGRAMMERS' | 'SWEXPERTACADEMY';

// Platform configuration
export interface PlatformConfig {
  platformName: PlatformName;
  loaderInterval?: number;
  resultMessages?: {
    SUCCESS: string;
    ACCEPTED?: string;
  };
}

// Submission data from platform
export interface SubmissionData {
  username?: string;
  problemId: string;
  result: string;
  language: string;
  runtime?: string;
  memory?: string;
  codeLength?: number;
  submissionId?: string;
  submissionTime?: string;
  code?: string;
}

// Submission checker types
export type CheckCondition = () => boolean;
export type SuccessCallback = () => void | Promise<void>;

export interface SubmissionCheckerOptions {
  caseSensitive?: boolean;
  timeout?: number;
}

// Upload state for platforms
export interface UploadState {
  uploading: boolean;
}

// Platform URL patterns
export interface PlatformUrls {
  readonly SUBMISSION_PAGE: RegExp | string;
  readonly PROBLEM_PAGE: RegExp | string;
}
