import UploadService from "@/commons/uploadservice.js";

/**
 * 백준 문제 풀이를 GitHub에 업로드합니다.
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
export default async function uploadOneSolveProblemOnGit(problemData, callback) {
  // 원본 데이터에 백준 플랫폼 정보와 문제 관련 메타데이터를 추가
  const enhancedData = {
    ...problemData,
    platform: "백준",
    problemInfo: {
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
    },
  };

  return UploadService.uploadProblem(enhancedData, callback);
}
