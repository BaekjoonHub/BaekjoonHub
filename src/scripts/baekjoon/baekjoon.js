import PlatformHubBase from "@/commons/platformhub-base.js";
import { SubmissionChecker } from "@/commons/loader-service.js";
import log from "@/commons/logger.js";
import { isEmpty, isNull } from "@/commons/util.js";
import { checkEnable } from "@/commons/enable.js";
import { RESULT_MESSAGE } from "@/baekjoon/variables.js";
import { findUsername, startUpload, markUploadedCSS, isExistResultTable, startMonitoringToast } from "@/baekjoon/util.js";
import { findData, parseProblemDescription, parsingResultTableList } from "@/baekjoon/parsing.js";
import uploadOneSolveProblemOnGit from "@/baekjoon/uploadfunctions.js";

class BaekjoonHub extends PlatformHubBase {
  constructor() {
    super({
      platformName: "백준",
      loaderInterval: 2000,
    });

    this.username = findUsername();
  }

  init() {
    setTimeout(async () => {
      super.init();

      log.info(`Initializing ${this.config.platformName} hub`);

      // Check if extension is enabled
      const enabled = await checkEnable();
      if (!enabled) {
        log.info("BaekjoonHub is disabled, skipping initialization");
        return;
      }

      // Try to find username again in case it wasn't available during construction
      this.username = findUsername();
      log.debug("BaekjoonHub Debug - Username found:", this.username);

      if (!isNull(this.username)) {
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
      } else {
        log.debug("BaekjoonHub Debug - Username is null, retrying in 1 second...");
        // Retry after a short delay in case page is still loading
        setTimeout(async () => {
          // Re-check if extension is enabled before retry
          const enabled = await checkEnable();
          if (!enabled) {
            log.info("BaekjoonHub is disabled, skipping retry");
            return;
          }

          this.username = findUsername();
          log.debug("BaekjoonHub Debug - Retry - Username found:", this.username);
          if (!isNull(this.username)) {
            this.init(); // Retry initialization
          }
        }, 1000);
      }
    }, 1000);
  }

  /**
   * Start monitoring for successful submissions
   */
  async startSubmissionMonitoring() {
    // Check if extension is enabled before showing monitoring toast
    const enabled = await checkEnable();
    if (!enabled) {
      return;
    }

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
      result === RESULT_MESSAGE.ac || result === RESULT_MESSAGE.Accepted || result === "맞았습니다!!" || result === "Accepted" || result.includes("맞았습니다") || result.startsWith("100");

    log.debug("BaekjoonHub Debug - Result validation:", {
      result: result,
      isAccepted: isAccepted,
    });

    return isAccepted;
  }
}

new BaekjoonHub();
