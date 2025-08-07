import PlatformHubBase from "@/commons/platformhub-base.js";
import { PLATFORMS } from "@/constants/config.js";

/**
 * Problem info mapper for Baekjoon platform
 */
const baekjoonProblemInfoMapper = (problemData) => ({
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
 * 백준 문제 풀이를 GitHub에 업로드합니다.
 * Uses the generic upload function from PlatformHubBase
 *
 * @param {Object} problemData - 업로드할 문제 데이터
 * @param {Function} callback - 업로드 완료 후 실행할 콜백 함수
 * @returns {Promise<void>}
 */
const uploadOneSolveProblemOnGit = PlatformHubBase.createUploadFunction(PLATFORMS.BAEKJOON, baekjoonProblemInfoMapper);

export default uploadOneSolveProblemOnGit;
