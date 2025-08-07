import { GitHub } from "./github.js";
import { getToken, getHook, getStats, saveStats, updateObjectDatafromPath } from "./storage.js";
import { isNull, isEmpty, preProcessEmptyObj } from "./util.js";
import log from "@/commons/logger.js";

/**
 * 모든 플랫폼에서 공통으로 사용할 수 있는 업로드 서비스 클래스
 * GitHub API를 사용하여 코드, README 등의 파일을 GitHub 저장소에 업로드합니다.
 */
export default class UploadService {
  /**
   * 문제 데이터를 GitHub에 업로드합니다。
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
    try {
      const { code, readme, directory, fileName, message } = problemData;

      const token = await getToken();
      const hook = await getHook();

      if (isNull(token) || isNull(hook)) {
        log.error("Token or hook is null", token, hook);
        return Promise.resolve();
      }

      // 업로드 전 현재 업로드할 파일의 SHA 값과 비교하여 중복 업로드 방지 로직은 플랫폼별 업로드 함수에서 처리함

      return this.upload(token, hook, code, readme, directory, fileName, message, callback);
    } catch (error) {
      log.error("Error uploading problem:", error);
      throw error; // 오류 위로 전파하여 호출자가 오류 처리할 수 있도록 함
    }
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
   * @returns {Promise<Object>} - 업로드 결과 정보
   */
  static async upload(token, hook, sourceText, readmeText, directory, filename, commitMessage, callback) {
    try {
      const git = new GitHub(hook, token);
      let stats = await getStats();

      // stats 객체 강제 초기화 확인
      if (!stats.branches) {
        stats.branches = {};
      }
      if (!stats.submission) {
        stats.submission = {};
      }

      // 기본 브랜치 확인
      let defaultBranch = stats.branches[hook];
      if (isNull(defaultBranch)) {
        try {
          defaultBranch = await git.getDefaultBranchOnRepo();
          stats.branches[hook] = defaultBranch;
        } catch (error) {
          log.error("Error getting default branch, using 'main':", error);
          defaultBranch = "main";
          stats.branches[hook] = defaultBranch;
        }
      }

      // GitHub 업로드 작업 수행
      const { refSHA, ref } = await git.getReference(defaultBranch);
      const source = await git.createBlob(sourceText, `${directory}/${filename}`);
      const readme = await git.createBlob(readmeText, `${directory}/README.md`);
      const treeSHA = await git.createTree(refSHA, [source, readme]);
      const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
      await git.updateHead(ref, commitSHA);

      // 통계 정보 업데이트
      if (stats.submission) {
        updateObjectDatafromPath(stats.submission, `${hook}/${source.path}`, source.sha);
        updateObjectDatafromPath(stats.submission, `${hook}/${readme.path}`, readme.sha);
      }
      await saveStats(stats);

      // 콜백 함수 실행
      if (typeof callback === "function" && stats.branches) {
        callback(stats.branches, directory);
      }

      log.info("Upload completed successfully", directory);

      // 업로드 결과 정보 반환
      return {
        success: true,
        uploadedFiles: {
          source: {
            path: source.path,
            sha: source.sha,
          },
          readme: {
            path: readme.path,
            sha: readme.sha,
          },
        },
        directory,
        commitSHA,
      };
    } catch (error) {
      log.error("Upload failed:", error);
      // 업로드 실패 시 콜백 함수를 호출하지 않음 - 오류 처리는 호출측에서 함
      throw error;
    }
  }

  /**
   * 파일 하나만 업로드합니다.
   * README와 소스코드를 분리해서 업로드해야 할 경우 사용합니다。
   *
   * @param {string} token - GitHub API 토큰
   * @param {string} hook - GitHub 저장소 (username/repo 형식)
   * @param {string} content - 파일 내용
   * @param {string} path - 파일 경로 (디렉토리 포함)
   * @param {string} commitMessage - 커밋 메시지
   * @returns {Promise<Object>} - 업로드 결과 정보
   */
  static async uploadSingleFile(token, hook, content, path, commitMessage) {
    try {
      const git = new GitHub(hook, token);
      let stats = await getStats();

      // stats 객체 강제 초기화 확인
      if (!stats.branches) {
        stats.branches = {};
      }
      if (!stats.submission) {
        stats.submission = {};
      }

      let defaultBranch = stats.branches[hook];
      if (isNull(defaultBranch)) {
        try {
          defaultBranch = await git.getDefaultBranchOnRepo();
          stats.branches[hook] = defaultBranch;
        } catch (error) {
          log.error("Error getting default branch, using 'main':", error);
          defaultBranch = "main";
          stats.branches[hook] = defaultBranch;
        }
      }

      const { refSHA, ref } = await git.getReference(defaultBranch);
      const file = await git.createBlob(content, path);
      const treeSHA = await git.createTree(refSHA, [file]);
      const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
      await git.updateHead(ref, commitSHA);

      if (stats.submission) {
        updateObjectDatafromPath(stats.submission, `${hook}/${file.path}`, file.sha);
      }
      await saveStats(stats);

      log.info("Single file upload completed successfully", path);

      return {
        success: true,
        uploadedFile: {
          path: file.path,
          sha: file.sha,
        },
        commitSHA,
      };
    } catch (error) {
      log.error("Single file upload failed:", error);
      throw error;
    }
  }
}

/**
 * Factory for creating platform-specific upload handlers
 */
export class UploadHandlerFactory {
  /**
   * Create an upload handler for a specific platform
   * @param {string} platformName - Name of the platform
   * @param {Function} parseDataFunction - Platform-specific data parsing function
   * @param {Function} uploadFunction - Platform-specific upload function
   * @param {Function} markFunction - Platform-specific mark function
   * @param {Function} startUploadFunction - Platform-specific start upload function
   */
  static create(platformName, parseDataFunction, uploadFunction, markFunction, startUploadFunction) {
    return async function () {
      try {
        const rawData = await parseDataFunction();
        const processedData = preProcessEmptyObj(rawData);
        log.debug(`${platformName} processed data:`, processedData);

        if (isEmpty(processedData)) {
          log.debug(`No data to upload for ${platformName}`);
          return false;
        }

        // Signal start of upload process
        if (startUploadFunction) {
          startUploadFunction();
        }

        return { success: true, data: processedData };
      } catch (error) {
        log.error(`Error in ${platformName} upload handler:`, error);
        throw error;
      }
    };
  }
}
