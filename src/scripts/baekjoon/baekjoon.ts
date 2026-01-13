/**
 * Baekjoon Hub main entry point
 * Content script for acmicpc.net (Baekjoon Online Judge)
 */
import PlatformHubBase, { log, checkEnable } from "@/commons/platformhub-base";
import { isEmpty, isNull } from "@/commons/util";
import { RESULT_MESSAGE } from "@/baekjoon/variables";
import { TIMEOUTS, RETRY_LIMITS, RESULT_MESSAGES, PLATFORMS } from "@/constants/config";
import {
  findUsername,
  startUpload,
  markUploadedCSS,
  isExistResultTable,
  startMonitoringToast,
} from "@/baekjoon/util";
import { findData, parseProblemDescription, parsingResultTableList } from "@/baekjoon/parsing";
import uploadOneSolveProblemOnGit from "@/baekjoon/uploadfunctions";

// Submission data interface
interface SubmissionData {
  problemId?: string;
  submissionId?: string;
  username?: string;
  result?: string;
  resultCategory?: string;
  language?: string;
  runtime?: string;
  memory?: string;
  codeLength?: string;
  submissionTime?: string;
  elementId?: string;
  [key: string]: string | undefined;
}

/**
 * BaekjoonHub class for handling Baekjoon Online Judge submissions
 * Extends PlatformHubBase for common platform functionality
 */
class BaekjoonHub extends PlatformHubBase {
  private username: string | null = null;

  constructor() {
    super({
      platformName: PLATFORMS.BAEKJOON,
      loaderInterval: TIMEOUTS.LOADER_INTERVAL,
    });

    this.username = findUsername();
  }

  /**
   * Initialize the BaekjoonHub extension
   */
  async init(): Promise<boolean> {
    const isEnabled = await super.init();
    if (!isEnabled) return false;

    // Retry finding username with exponential backoff
    const foundUsername = await this.retryFindUsername();
    if (!foundUsername) {
      log.warn("Could not find username after multiple retries");
      return false;
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

    return true;
  }

  /**
   * Retry finding username with exponential backoff
   * @returns True if username found
   */
  private async retryFindUsername(): Promise<boolean> {
    for (let i = 0; i < RETRY_LIMITS.USERNAME_MAX_RETRIES; i++) {
      this.username = findUsername();
      if (!isNull(this.username)) {
        log.debug("Username found:", this.username);
        return true;
      }

      if (i < RETRY_LIMITS.USERNAME_MAX_RETRIES - 1) {
        const delay = Math.min(
          TIMEOUTS.USERNAME_RETRY * Math.pow(2, i),
          TIMEOUTS.MAX_RETRY_WAIT
        );
        log.debug(
          `Username not found, retrying in ${delay}ms (attempt ${i + 1}/${RETRY_LIMITS.USERNAME_MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  /**
   * Start monitoring for successful submissions
   */
  private async startSubmissionMonitoring(): Promise<void> {
    // Show monitoring toast when entering submission page
    startMonitoringToast();

    let table: SubmissionData[] = [];

    const checker = (): boolean => {
      log.debug("BaekjoonHub Debug - Checking for result table...");

      if (!isExistResultTable()) {
        log.debug("BaekjoonHub Debug - Result table not found");
        return false;
      }

      log.debug("BaekjoonHub Debug - Result table exists");

      try {
        table = parsingResultTableList(document);
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

    const onSuccess = async (): Promise<void> => {
      log.info("풀이가 맞았습니다. 업로드를 시작합니다.");

      // Show upload start toast
      startUpload();

      try {
        if (!table || isEmpty(table)) {
          log.error("BaekjoonHub Debug - No table data available for upload");
          return;
        }

        const data = table[0];
        log.debug("BaekjoonHub Debug - Processing submission data:", data);

        // Create and execute upload handler
        const bojData = await this.createAndExecuteUploadHandler(
          () => findData(data),
          uploadOneSolveProblemOnGit,
          markUploadedCSS,
          undefined
        );

        if (isNull(bojData)) {
          log.error("BaekjoonHub Debug - Failed to get bojData, skipping upload.");
          return;
        }

        log.debug("BaekjoonHub Debug - Upload data prepared:", bojData);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.beginUpload(bojData.data as any, uploadOneSolveProblemOnGit, markUploadedCSS);
      } catch (error) {
        log.error("BaekjoonHub Debug - Error during upload process:", error);
      }
    };

    // Setup submission monitoring
    this.setupSubmissionMonitoring(checker, onSuccess);
  }

  /**
   * Check if submission data represents a valid successful submission
   * @param data - Submission data from result table
   * @returns Whether submission is valid and successful
   */
  private isValidSubmission(data: SubmissionData): boolean {
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
    if (
      !Object.prototype.hasOwnProperty.call(data, "username") ||
      !Object.prototype.hasOwnProperty.call(data, "result")
    ) {
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
      (result?.includes("맞았습니다") ?? false) ||
      (result?.startsWith("100") ?? false);

    log.debug("BaekjoonHub Debug - Result validation:", {
      result: result,
      isAccepted: isAccepted,
    });

    return isAccepted;
  }
}

// Initialize BaekjoonHub
new BaekjoonHub();
