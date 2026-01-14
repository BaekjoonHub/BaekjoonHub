/**
 * Baekjoon-specific storage with TTL caching
 * Handles problem data, submission code, and Solved.ac data caching
 *
 * Refactored to use CacheRepository for code deduplication
 */
import { CacheRepository } from "@/commons/cache-repository";
import type { CacheEntry } from "@/commons/cache-repository";

// Problem description data structure
export interface ProblemDescription {
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
}

// Cache instances using CacheRepository
const problemCache = new CacheRepository<ProblemDescription>("problem", {
  ttl: 7 * 86400000, // 7 days
  maxSize: 1000,
});

const submitCodeCache = new CacheRepository<string>("scode", {
  ttl: 7 * 86400000, // 7 days
  maxSize: 1000,
});

const solvedACCache = new CacheRepository<unknown>("solvedac", {
  ttl: 7 * 86400000, // 7 days
  maxSize: 1000,
});

// Problem data interface (for compatibility with existing code)
interface ProblemCacheData {
  problemId: string;
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
}

/**
 * Update cached problem data
 */
export async function updateProblemData(problem: ProblemCacheData): Promise<void> {
  const data: ProblemDescription = {
    problemDescription: problem.problemDescription || problem.problem_description,
    problemInput: problem.problemInput || problem.problem_input,
    problemOutput: problem.problemOutput || problem.problem_output,
  };
  await problemCache.set(problem.problemId, data);
}

/**
 * Get cached problem data by ID
 */
export async function getProblemData(problemId: string | number): Promise<ProblemDescription | null> {
  return problemCache.get(problemId);
}

// Submit code data interface
interface SubmitCodeCacheData {
  submissionId: string | number;
  code: string;
}

/**
 * Update cached submission code
 */
export async function updateSubmitCodeData(obj: SubmitCodeCacheData): Promise<void> {
  await submitCodeCache.set(obj.submissionId, obj.code);
}

/**
 * Get cached submission code by ID
 */
export async function getSubmitCodeData(submissionId: string | number): Promise<string | null> {
  return submitCodeCache.get(submissionId);
}

// Solved.ac data interface
interface SolvedACCacheData {
  problemId: string | number;
  jsonData: unknown;
}

/**
 * Update cached Solved.ac data
 */
export async function updateSolvedACData(obj: SolvedACCacheData): Promise<void> {
  await solvedACCache.set(obj.problemId, obj.jsonData);
}

/**
 * Get cached Solved.ac data by ID
 */
export async function getSolvedACData(problemId: string | number): Promise<unknown | null> {
  return solvedACCache.get(problemId);
}
