/**
 * Upload-related type definitions
 */

import type { ProblemData } from './problem';

// Upload result
export interface UploadResult {
  success: boolean;
  uploadedFiles?: {
    source: FileUploadInfo;
    readme: FileUploadInfo;
  };
  uploadedFile?: FileUploadInfo;
  directory?: string;
  commitSHA?: string;
  error?: string;
}

export interface FileUploadInfo {
  path: string;
  sha: string;
}

// Upload callback function type
export type UploadCallback = (
  branches: Record<string, string>,
  directory: string
) => void;

// Upload function type
export type UploadFunction = (
  problemData: ProblemData,
  callback: UploadCallback
) => Promise<UploadResult>;

// Upload handler result
export interface UploadHandlerResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Parse data function type
export type ParseDataFunction = () => Promise<unknown> | unknown;

// Mark function type
export type MarkFunction = (
  branches: Record<string, string>,
  directory: string
) => void;

// Start upload function type
export type StartUploadFunction = () => void;

// Upload handler factory create function
export type UploadHandlerCreator = (
  platformName: string,
  parseDataFunction: ParseDataFunction,
  uploadFunction: UploadFunction,
  markFunction: MarkFunction,
  startUploadFunction: StartUploadFunction
) => () => Promise<UploadHandlerResult>;
