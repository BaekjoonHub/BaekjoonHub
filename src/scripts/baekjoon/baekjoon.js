import PlatformHubBase, { log, checkEnable } from "@/commons/platformhub-base.js";
import { SubmissionChecker } from "@/commons/loader-service.js";
import { isEmpty, isNull } from "@/commons/util.js";
import { RESULT_MESSAGE } from "@/baekjoon/variables.js";
import { TIMEOUTS, RETRY_LIMITS, RESULT_MESSAGES, PLATFORMS } from "@/constants/config.js";
import { findUsername, startUpload, markUploadedCSS, isExistResultTable, startMonitoringToast } from "@/baekjoon/util.js";
import { findData, parseProblemDescription, parsingResultTableList } from "@/baekjoon/parsing.js";
import uploadOneSolveProblemOnGit from "@/baekjoon/uploadfunctions.js";

class BaekjoonHub extends PlatformHubBase {
  constructor() {
    super({
      platformName: PLATFORMS.BAEKJOON,
      loaderInterval: TIMEOUTS.LOADER_INTERVAL,
    });

    this.username = findUsername();
  }

  async init() {
    const isEnabled = await super.init();
    if (!isEnabled) return;

    // Retry finding username with exponential backoff
    const foundUsername = await this.retryFindUsername();
    if (!foundUsername) {
      log.warn("Could not find username after multiple retries");
      return;
    }

    const requiredParams = ["status", `user_id=${this.username}`, "problem_id", "from_mine=1"];

    log.debug("BaekjoonHub Debug - Required params:", requiredParams);
    log.debug(
      "BaekjoonHub Debug - URL contains all params:",
      requiredParams.every((key) => this.currentUrl.includes(key))
    );

    if (requiredParams.every((key) => this.currentUrl.includes(key))) {
      log.debug("BaekjoonHub Debug - Starting submission monitoring");
      this.startSubmissionMonitoring();
    } else if (/\.net\/problem\/\d+/.test(this.currentUrl)) {
      log.debug("BaekjoonHub Debug - Parsing problem description");
      parseProblemDescription();
    } else {
      log.debug("BaekjoonHub Debug - No matching URL pattern");
    }
  }

  /**
   * Retry finding username with exponential backoff
   * @returns {Promise<boolean>} True if username found
   */
  async retryFindUsername() {
    for (let i = 0; i < RETRY_LIMITS.USERNAME_MAX_RETRIES; i++) {
      this.username = findUsername();
      if (!isNull(this.username)) {
        log.debug("Username found:", this.username);
        return true;
      }

      if (i < RETRY_LIMITS.USERNAME_MAX_RETRIES - 1) {
        const delay = Math.min(TIMEOUTS.USERNAME_RETRY * Math.pow(2, i), TIMEOUTS.MAX_RETRY_WAIT);
        log.debug(`Username not found, retrying in ${delay}ms (attempt ${i + 1}/${RETRY_LIMITS.USERNAME_MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  /**
   * Start monitoring for successful submissions
   */
  async startSubmissionMonitoring() {
    // 제출 페이지에 들어가자마자 모니터링 Toast 표시
    startMonitoringToast();

    let table; // Declare table in a broader scope

    const checker = () => {
      log.debug("BaekjoonHub Debug - Checking for result table...");

      if (!isExistResultTable()) {
        log.debug("BaekjoonHub Debug - Result table not found");
        return false;
      }

      log.debug("BaekjoonHub Debug - Result table exists");

      try {
        table = parsingResultTableList(document); // Pass document explicitly
        log.debug("BaekjoonHub Debug - Table data:", table);
      } catch (error) {
        log.error("BaekjoonHub Debug - Error parsing result table:", error);
        return false;
      }

      if (isEmpty(table)) {
        log.debug("BaekjoonHub Debug - Table is empty");
        return false;
      }

      const data = table[0];
      log.debug("BaekjoonHub Debug - First submission data:", data);

      if (!data) {
        log.debug("BaekjoonHub Debug - No submission data found");
        return false;
      }

      const isValid = this.isValidSubmission(data);
      log.debug("BaekjoonHub Debug - Is valid submission:", isValid);
      return isValid;
    };

    const onSuccess = async () => {
      log.info("풀이가 맞았습니다. 업로드를 시작합니다.");

      // 업로드 시작 Toast 표시
      startUpload();

      try {
        if (!table || isEmpty(table)) {
          log.error("BaekjoonHub Debug - No table data available for upload");
          return;
        }

        const data = table[0]; // Now table is accessible
        log.debug("BaekjoonHub Debug - Processing submission data:", data);

        // 업로드 핸들러 생성 및 실행 (Toast는 위에서 이미 표시됨)
        const bojData = await this.createAndExecuteUploadHandler(() => findData(data), uploadOneSolveProblemOnGit, markUploadedCSS, null);

        if (isNull(bojData)) {
          log.error("BaekjoonHub Debug - Failed to get bojData, skipping upload.");
          return;
        }

        log.debug("BaekjoonHub Debug - Upload data prepared:", bojData);
        await this.beginUpload(bojData, uploadOneSolveProblemOnGit, markUploadedCSS);
      } catch (error) {
        log.error("BaekjoonHub Debug - Error during upload process:", error);
      }
    };

    // Use proper submission monitoring setup
    this.setupSubmissionMonitoring(checker, onSuccess);
  }

  /**
   * Check if submission data represents a valid successful submission
   * @param {Object} data - Submission data from result table
   * @returns {boolean}
   */
  isValidSubmission(data) {
    if (!data) {
      log.debug("BaekjoonHub Debug - No data provided for validation");
      return false;
    }

    const { username, result } = data;

    log.debug("BaekjoonHub Debug - Validating submission:", {
      username: username,
      expectedUsername: this.username,
      result: result,
    });

    // Check if required fields exist
    if (!Object.prototype.hasOwnProperty.call(data, "username") || !Object.prototype.hasOwnProperty.call(data, "result")) {
      log.debug("BaekjoonHub Debug - Missing required fields");
      return false;
    }

    // Check if username matches
    if (username !== this.username) {
      log.debug("BaekjoonHub Debug - Username mismatch");
      return false;
    }

    // Check if result indicates success
    const isAccepted =
      result === RESULT_MESSAGE.ac ||
      result === RESULT_MESSAGE.Accepted ||
      result === RESULT_MESSAGES.BAEKJOON.SUCCESS ||
      result === RESULT_MESSAGES.BAEKJOON.ACCEPTED ||
      result.includes("맞았습니다") ||
      result.startsWith("100");

    log.debug("BaekjoonHub Debug - Result validation:", {
      result: result,
      isAccepted: isAccepted,
    });

    return isAccepted;
  }
}

new BaekjoonHub();
