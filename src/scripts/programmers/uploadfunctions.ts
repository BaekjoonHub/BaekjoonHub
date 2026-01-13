/**
 * Programmers upload function
 * Creates GitHub upload function using PlatformHubBase
 */
import PlatformHubBase from "@/commons/platformhub-base";
import { PLATFORMS } from "@/constants/config";
import type { BaseProblemInfo } from "@/types/problem";

// Programmers-specific problem info interface
interface ProgrammersProblemInfo extends BaseProblemInfo {
  division?: string;
  result_message?: string;
  problem_description?: string;
}

/**
 * Problem info mapper for Programmers platform
 * Maps raw problem data to standardized ProblemInfo format
 */
const programmersProblemInfoMapper = (
  problemData: Partial<ProgrammersProblemInfo>
): ProgrammersProblemInfo => ({
  problemId: problemData.problemId || "",
  title: problemData.title || "",
  level: problemData.level || "",
  language: problemData.language || "",
  memory: problemData.memory || "",
  runtime: problemData.runtime || "",
  submissionTime: problemData.submissionTime || "",
  division: problemData.division || "",
  problem_description: problemData.problem_description || "",
  result_message: problemData.result_message || "",
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
  PLATFORMS.PROGRAMMERS,
  programmersProblemInfoMapper
);

export default uploadOneSolveProblemOnGit;
