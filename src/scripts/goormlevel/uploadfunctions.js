import PlatformHubBase from "@/commons/platformhub-base.js";
import { PLATFORMS } from "@/constants/config.js";

/**
 * Problem info mapper for Goorm Level platform
 */
const goormlevelProblemInfoMapper = (problemData) => ({
  problemId: problemData.problemId || "",
  title: problemData.title || "",
  level: problemData.level || "",
  language: problemData.language || "",
  memory: problemData.memory || "",
  runtime: problemData.runtime || "",
  submissionTime: problemData.submissionTime || "",
  problem_description: problemData.problem_description || "",
  problem_input: problemData.problem_input || "",
  problem_output: problemData.problem_output || "",
  result_message: problemData.result_message || "",
});

/**
 * 구름레벨 문제 풀이를 GitHub에 업로드합니다.
 * Uses the generic upload function from PlatformHubBase
 *
 * @param {Object} problemData - 업로드할 문제 데이터
 * @param {string} problemData.code - 소스코드 내용
 * @param {string} problemData.readme - README.md 내용
 * @param {string} problemData.directory - 업로드할 디렉토리 경로
 * @param {string} problemData.fileName - 소스코드 파일명
 * @param {string} problemData.message - 커밋 메시지
 * @param {Function} callback - 업로드 완료 후 실행할 콜백 함수 (마크업 아이콘 표시 등)
 * @returns {Promise<void>}
 */
const uploadOneSolveProblemOnGit = PlatformHubBase.createUploadFunction(PLATFORMS.GOORMLEVEL, goormlevelProblemInfoMapper);

export default uploadOneSolveProblemOnGit;
