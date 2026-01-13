/**
 * Baekjoon upload function
 * Creates GitHub upload function using PlatformHubBase
 */
import PlatformHubBase from "@/commons/platformhub-base";
import { PLATFORMS } from "@/constants/config";
import type { ProblemData, ProblemInfo } from "@/types/problem";

/**
 * Problem info mapper for Baekjoon platform
 * Maps raw problem data to standardized ProblemInfo format
 */
const baekjoonProblemInfoMapper = (problemData: Partial<ProblemInfo>): ProblemInfo => ({
  problemId: problemData.problemId || "",
  title: problemData.title || "",
  level: problemData.level || "",
  language: problemData.language || "",
  memory: problemData.memory || "",
  runtime: problemData.runtime || "",
  submissionTime: problemData.submissionTime || "",
  problem_tags: problemData.problem_tags || [],
  problem_description: problemData.problem_description || "",
  problem_input: problemData.problem_input || "",
  problem_output: problemData.problem_output || "",
});

/**
 * Upload one solved problem to GitHub
 * Uses the generic upload function from PlatformHubBase
 *
 * @param problemData - Problem data to upload
 * @param callback - Callback function after upload completes
 * @returns Promise<void>
 */
const uploadOneSolveProblemOnGit = PlatformHubBase.createUploadFunction(
  PLATFORMS.BAEKJOON,
  baekjoonProblemInfoMapper
);

export default uploadOneSolveProblemOnGit;
