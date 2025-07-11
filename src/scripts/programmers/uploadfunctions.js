import UploadService from "@/commons/uploadservice.js";

/**
 * 프로그래머스 문제 풀이를 GitHub에 업로드합니다.
 *
 * @param {Object} bojData - 업로드할 문제 데이터
 * @param {string} bojData.code - 소스코드 내용
 * @param {string} bojData.readme - README.md 내용
 * @param {string} bojData.directory - 업로드할 디렉토리 경로
 * @param {string} bojData.fileName - 소스코드 파일명
 * @param {string} bojData.message - 커밋 메시지
 * @param {Function} callback - 업로드 완료 후 실행할 콜백 함수 (마크업 아이콘 표시 등)
 * @returns {Promise<void>}
 */
export default async function uploadOneSolveProblemOnGit(bojData, callback) {
  // 원본 데이터에 프로그래머스 플랫폼 정보와 문제 관련 메타데이터를 추가
  const enhancedData = {
    ...bojData,
    platform: "프로그래머스",
    problemInfo: {
      problemId: bojData.problemId || "",
      title: bojData.title || "",
      level: bojData.level || "",
      language: bojData.language || "",
      memory: bojData.memory || "",
      runtime: bojData.runtime || "",
      submissionTime: bojData.submissionTime || "",
      division: bojData.division || "",
      problem_description: bojData.problem_description || "",
      result_message: bojData.result_message || "",
    },
  };

  return UploadService.uploadProblem(enhancedData, callback);
}
