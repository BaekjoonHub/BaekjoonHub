/**
 * BaekjoonHub Type Definitions
 *
 * This module re-exports all type definitions for easy importing.
 */

// Config types
export type {
  Timeouts,
  RetryLimits,
  ResultMessage,
  ResultMessages,
  GitHubApiConfig,
  LogLevels,
  LogLevel,
  FileLimits,
  PlatformSelectors,
  Selectors,
  Defaults,
} from './config';

// Platform types
export type {
  PlatformName,
  PlatformKey,
  PlatformConfig,
  SubmissionData,
  CheckCondition,
  SuccessCallback,
  SubmissionCheckerOptions,
  UploadState,
  PlatformUrls,
} from './platform';

// Problem types
export type {
  BaseProblemInfo,
  BaekjoonProblemInfo,
  ProgrammersProblemInfo,
  GoormLevelProblemInfo,
  SWEAProblemInfo,
  ProblemInfo,
  ProblemData,
  ProblemInfoMapper,
  ParsedProblemData,
} from './problem';

// Upload types
export type {
  UploadResult,
  FileUploadInfo,
  UploadCallback,
  UploadFunction,
  UploadHandlerResult,
  ParseDataFunction,
  MarkFunction,
  StartUploadFunction,
  UploadHandlerCreator,
} from './upload';

// Storage types
export type {
  StorageKeys,
  Stats,
  StorageData,
  StorageArea,
  BatchUpdate,
  PathUpdate,
} from './storage';

// GitHub types
export type {
  GitHubReference,
  GitHubTreeItem,
  GitHubRepository,
  GitHubCommit,
  GitHubFileContent,
  GitHubTreeResponse,
  GitHubApiError,
  IGitHub,
} from './github';

// Toast types
export type {
  ToastType,
  ToastTypeColors,
  ToastColors,
  ToastConfig,
  ToastOptions,
  IToast,
  IToastManager,
} from './toast';
