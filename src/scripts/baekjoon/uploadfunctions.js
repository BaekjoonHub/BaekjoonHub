import { UploadService } from '../UploadService.js';

/** 
 * 백준 문제 풀이를 GitHub에 업로드합니다.
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
export async function uploadOneSolveProblemOnGit(bojData, callback) {
  // 원본 데이터에 백준 플랫폼 정보와 문제 관련 메타데이터를 추가
  const enhancedData = {
    ...bojData,
    platform: '백준',
    problemInfo: {
      problemId: bojData.problemId || '',
      title: bojData.title || '',
      level: bojData.level || '',
      language: bojData.language || '',
      memory: bojData.memory || '',
      runtime: bojData.runtime || '',
      submissionTime: bojData.submissionTime || '',
      problem_tags: bojData.problem_tags || [],
      problem_description: bojData.problem_description || '',
      problem_input: bojData.problem_input || '',
      problem_output: bojData.problem_output || ''
    }
  };
  
  return UploadService.uploadProblem(enhancedData, callback);
}
