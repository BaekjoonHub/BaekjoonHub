/**
 * Problem-related type definitions
 */

// Base problem info common to all platforms
export interface BaseProblemInfo {
  problemId: string;
  title: string;
  level: string;
  language: string;
  memory: string;
  runtime: string;
  submissionTime: string;
  [key: string]: string | string[] | undefined;
}

// Baekjoon-specific problem info
export interface BaekjoonProblemInfo extends BaseProblemInfo {
  problem_tags?: string[];
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
}

// Programmers-specific problem info
export interface ProgrammersProblemInfo extends BaseProblemInfo {
  division?: string;
  problem_description?: string;
  result_message?: string;
}

// GoormLevel-specific problem info
export interface GoormLevelProblemInfo extends BaseProblemInfo {
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
  result_message?: string;
}

// SWEA-specific problem info
export interface SWEAProblemInfo extends BaseProblemInfo {
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
  result_message?: string;
}

// Union type for all problem info types
export type ProblemInfo =
  | BaseProblemInfo
  | BaekjoonProblemInfo
  | ProgrammersProblemInfo
  | GoormLevelProblemInfo
  | SWEAProblemInfo;

// Problem data for upload
export interface ProblemData {
  code: string;
  readme: string;
  directory: string;
  fileName: string;
  message: string;
  platform: string;
  problemInfo: ProblemInfo;
}

// Problem info mapper function type
export type ProblemInfoMapper<T extends BaseProblemInfo = BaseProblemInfo> = (
  data: Partial<T>
) => T;

// Parsed problem data from DOM
export interface ParsedProblemData {
  title?: string;
  problemId?: string;
  level?: string;
  language?: string;
  code?: string;
  memory?: string;
  runtime?: string;
  submissionTime?: string;
  description?: string;
  input?: string;
  output?: string;
  tags?: string[];
  [key: string]: unknown;
}
