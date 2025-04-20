import { GitHub } from './Github.js';
import { getToken, getHook, getStats, saveStats } from './storage.js';
import { updateObjectDatafromPath, isNull, log } from './util.js';

/**
 * 모든 플랫폼에서 공통으로 사용할 수 있는 업로드 서비스 클래스
 * GitHub API를 사용하여 코드, README 등의 파일을 GitHub 저장소에 업로드합니다.
 */
export class UploadService {
  /**
   * 문제 데이터를 GitHub에 업로드합니다.
   * 
   * @param {Object} problemData - 업로드할 문제 데이터
   * @param {string} problemData.code - 소스코드 내용
   * @param {string} problemData.readme - README.md 내용
   * @param {string} problemData.directory - 업로드할 디렉토리 경로
   * @param {string} problemData.fileName - 소스코드 파일명
   * @param {string} problemData.message - 커밋 메시지
   * @param {string} problemData.platform - 플랫폼 정보(백준, 프로그래머스, SWEA, goormlevel)
   * @param {Object} problemData.problemInfo - 문제 관련 메타 정보
   * @param {Function} callback - 업로드 완료 후 실행할 콜백 함수
   * @returns {Promise<void>}
   */
  static async uploadProblem(problemData, callback) {
    const { code, readme, directory, fileName, message, platform, problemInfo } = problemData;
    
    const token = await getToken();
    const hook = await getHook();
    
    if (isNull(token) || isNull(hook)) {
      console.error('Token or hook is null', token, hook);
      return;
    }
    
    return this.upload(token, hook, code, readme, directory, fileName, message, callback);
  }
  
  /**
   * GitHub API를 사용하여 파일을 업로드합니다.
   * 
   * @param {string} token - GitHub API 토큰
   * @param {string} hook - GitHub 저장소 (username/repo 형식)
   * @param {string} sourceText - 업로드할 소스코드
   * @param {string} readmeText - 업로드할 README 내용
   * @param {string} directory - 업로드할 디렉토리 경로
   * @param {string} filename - 업로드할 파일명
   * @param {string} commitMessage - 커밋 메시지
   * @param {Function} callback - 업로드 완료 후 실행할 콜백 함수
   * @returns {Promise<void>}
   */
  static async upload(token, hook, sourceText, readmeText, directory, filename, commitMessage, callback) {
    const git = new GitHub(hook, token);
    const stats = await getStats();
    
    // 기본 브랜치 확인
    let defaultBranch = stats.branches[hook];
    if (isNull(defaultBranch)) {
      defaultBranch = await git.getDefaultBranchOnRepo();
      stats.branches[hook] = defaultBranch;
    }
    
    // GitHub 업로드 작업 수행
    const { refSHA, ref } = await git.getReference(defaultBranch);
    const source = await git.createBlob(sourceText, `${directory}/${filename}`);
    const readme = await git.createBlob(readmeText, `${directory}/README.md`);
    const treeSHA = await git.createTree(refSHA, [source, readme]);
    const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
    await git.updateHead(ref, commitSHA);
    
    // 통계 정보 업데이트
    updateObjectDatafromPath(stats.submission, `${hook}/${source.path}`, source.sha);
    updateObjectDatafromPath(stats.submission, `${hook}/${readme.path}`, readme.sha);
    await saveStats(stats);
    
    // 콜백 함수 실행
    if (typeof callback === 'function') {
      callback(stats.branches, directory);
    }
    
    log('Upload completed successfully', directory);
  }
}
