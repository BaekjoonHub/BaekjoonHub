/**
 * Base class for all platform hub implementations
 * Provides common functionality for submission monitoring and upload handling
 */
import { isNull, isEmpty, calculateBlobSHA, getVersion } from "@/commons/util";
import { getStats, getHook, saveStats, updateLocalStorageStats, getStatsSHAfromPath } from "@/commons/storage";
import { Toast } from "@/commons/toast";
import { checkEnable } from "@/commons/enable";
import { LoaderFactory, LoaderService } from "@/commons/loader-service";
import UploadService, { UploadHandlerFactory } from "@/commons/upload-service";
import log from "@/commons/logger";
import { TIMEOUTS, RETRY_LIMITS } from "@/constants/config";
import type { PlatformConfig, CheckCondition, SuccessCallback } from "@/types/platform";
import type { BaseProblemInfo, ProblemInfoMapper } from "@/types/problem";
import type { UploadCallback, MarkFunction, ParseDataFunction, StartUploadFunction, UploadHandlerResult } from "@/types/upload";

// Re-export commonly used utilities for subclasses
export { Toast, checkEnable, log };

// Platform hub configuration interface
interface PlatformHubConfig {
  loaderInterval?: number;
  platformName?: string;
  resultMessages?: {
    SUCCESS: string;
    ACCEPTED?: string;
  };
}

// Upload data interface
interface UploadData {
  directory: string;
  fileName: string;
  code: string;
  [key: string]: unknown;
}

/**
 * Base class for all platform hub implementations
 * Provides common functionality for submission monitoring and upload handling
 */
export default class PlatformHubBase {
  protected loader: ReturnType<typeof setInterval> | null = null;
  protected loaderService: LoaderService | null = null;
  protected currentUrl: string;
  protected currentPathname: string;
  protected config: PlatformHubConfig;

  constructor(config: PlatformHubConfig = {}) {
    this.currentUrl = window.location.href;
    this.currentPathname = window.location.pathname;
    this.config = {
      loaderInterval: TIMEOUTS.LOADER_INTERVAL,
      platformName: "unknown",
      ...config,
    };

    this.init().catch((error) => log.error(`Error initializing ${this.config.platformName}:`, error));
  }

  /**
   * Initialize the platform hub
   * This method should be overridden by subclasses
   * @returns Whether initialization was successful
   */
  async init(): Promise<boolean> {
    log.info(`Initializing ${this.config.platformName} hub`);

    // Check if extension is enabled globally
    const enabled = await checkEnable();
    if (!enabled) {
      log.info(`${this.config.platformName} hub is disabled, skipping initialization`);
      return false;
    }

    return true;
  }

  /**
   * Start the submission monitoring loader
   * @param checkCondition - Function that returns true when submission should be processed
   * @param onSuccess - Function to call when successful submission is detected
   */
  startLoader(checkCondition: CheckCondition, onSuccess: SuccessCallback): void {
    this.loader = setInterval(async () => {
      try {
        const enable = await checkEnable();
        if (!enable) {
          this.stopLoader();
          return;
        }

        if (await checkCondition()) {
          log.info(`정답이 나왔습니다. ${this.config.platformName} 업로드를 시작합니다.`);
          this.stopLoader();
          await onSuccess();
        }
      } catch (error) {
        log.error(`Error in ${this.config.platformName} loader:`, error);
        this.stopLoader();
      }
    }, this.config.loaderInterval);
  }

  /**
   * Generic submission monitoring setup using LoaderService
   * @param checker - Checker function or SubmissionChecker instance
   * @param onSuccess - Success callback
   */
  setupSubmissionMonitoring(checker: CheckCondition, onSuccess: SuccessCallback): void {
    const loader = LoaderFactory.create(this.config.platformName || "unknown", {
      interval: this.config.loaderInterval,
    });
    loader.start(checker, onSuccess);
    this.loaderService = loader;
  }

  /**
   * Generic upload handler creation and execution
   * @param parseDataFn - Data parsing function
   * @param uploadFn - Upload function
   * @param markFn - Mark uploaded function
   * @param startUploadFn - Start upload function
   */
  async createAndExecuteUploadHandler(
    parseDataFn: ParseDataFunction,
    uploadFn: unknown,
    markFn: MarkFunction,
    startUploadFn?: StartUploadFunction
  ): Promise<UploadHandlerResult> {
    const uploadHandler = UploadHandlerFactory.create(
      this.config.platformName || "unknown",
      parseDataFn,
      uploadFn,
      markFn,
      startUploadFn
    );

    return await uploadHandler();
  }

  /**
   * Stop the submission monitoring loader
   */
  stopLoader(): void {
    if (this.loader) {
      clearInterval(this.loader);
      this.loader = null;
    }
    if (this.loaderService) {
      this.loaderService.stop();
      this.loaderService = null;
    }
  }

  /**
   * Common upload logic for all platforms
   * @param data - Parsed problem data
   * @param uploadFunction - Platform-specific upload function
   * @param markFunction - Platform-specific mark function
   */
  async beginUpload(
    data: UploadData,
    uploadFunction: (data: UploadData, callback: UploadCallback) => Promise<void>,
    markFunction: MarkFunction
  ): Promise<void> {
    try {
      log.debug(`${this.config.platformName} data:`, data);

      if (isEmpty(data)) {
        log.debug(`No data to upload for ${this.config.platformName}`);
        return;
      }

      const [stats, hook] = await Promise.all([getStats(), getHook()]);
      const currentVersion = stats.version;

      const shouldUpdateVersion =
        isNull(currentVersion) ||
        currentVersion !== getVersion() ||
        isNull(await getStatsSHAfromPath(hook || ""));

      if (shouldUpdateVersion) {
        await this.versionUpdate();
      }

      const filePath = `${hook}/${data.directory}/${data.fileName}`;
      const [cachedSHA, calcSHA] = await Promise.all([
        getStatsSHAfromPath(filePath),
        calculateBlobSHA(data.code),
      ]);

      log.debug("cachedSHA", cachedSHA, "calcSHA", calcSHA);

      if (cachedSHA === calcSHA) {
        markFunction(stats.branches, data.directory);
        log.info(`현재 제출번호를 업로드한 기록이 있습니다. (${this.config.platformName})`);
        return;
      }

      await uploadFunction(data, markFunction);
    } catch (error) {
      log.error(`Error in ${this.config.platformName} upload:`, error);
      Toast.raiseToast(`${this.config.platformName} 업로드 중 오류가 발생했습니다.`);
    }
  }

  /**
   * Update version information
   */
  async versionUpdate(): Promise<void> {
    try {
      log.info(`start versionUpdate for ${this.config.platformName}`);
      const stats = await updateLocalStorageStats();
      stats.version = getVersion();
      await saveStats(stats);
      log.debug("stats updated.", stats);
    } catch (error) {
      log.error(`Error updating version for ${this.config.platformName}:`, error);
    }
  }

  /**
   * Check if current URL matches any of the provided patterns
   * @param patterns - URL patterns to match
   */
  matchesUrl(patterns: (string | RegExp)[]): boolean {
    return patterns.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(this.currentUrl) || pattern.test(this.currentPathname);
      }
      return this.currentUrl.includes(pattern);
    });
  }

  /**
   * Safely query DOM element with optional chaining
   * @param selector - CSS selector
   */
  querySelector<T extends Element = Element>(selector: string): T | null {
    return document.querySelector<T>(selector);
  }

  /**
   * Safely query multiple DOM elements
   * @param selector - CSS selector
   */
  querySelectorAll<T extends Element = Element>(selector: string): T[] {
    return Array.from(document.querySelectorAll<T>(selector));
  }

  /**
   * Get text content from element with safe fallback
   * @param selector - CSS selector
   */
  getTextContent(selector: string): string {
    const element = this.querySelector(selector);
    return element?.textContent?.trim() || "";
  }

  /**
   * Create a generic upload function for platform-specific implementations
   * This eliminates code duplication across platform upload functions
   * @param platformName - Platform display name
   * @param problemInfoMapper - Function to map problem data to platform-specific format
   */
  static createUploadFunction<T extends BaseProblemInfo>(
    platformName: string,
    problemInfoMapper?: ProblemInfoMapper<T>
  ): (problemData: UploadData, callback: UploadCallback) => Promise<void> {
    return async function uploadOneSolveProblemOnGit(
      problemData: UploadData,
      callback: UploadCallback
    ): Promise<void> {
      try {
        const enhancedData = {
          ...problemData,
          platform: platformName,
          problemInfo: problemInfoMapper
            ? problemInfoMapper(problemData as unknown as Partial<T>)
            : problemData.problemInfo,
          readme: (problemData.readme as string) || "",
          message: (problemData.message as string) || "",
        };
        await UploadService.uploadProblem(
          enhancedData as unknown as {
            code: string;
            readme: string;
            directory: string;
            fileName: string;
            message: string;
          },
          callback
        );
      } catch (error) {
        log.error(`Error in ${platformName} upload function:`, error);
        throw error;
      }
    };
  }

  /**
   * Retry operation with exponential backoff
   * @param operation - Async operation to retry
   * @param maxRetries - Maximum number of retries
   * @param operationName - Name for logging
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = RETRY_LIMITS.API_MAX_RETRIES,
    operationName = "operation"
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) {
          log.error(`${operationName} failed after ${maxRetries} retries:`, error);
          throw error;
        }
        const delay = Math.min(TIMEOUTS.API_RETRY_BASE * Math.pow(2, i), TIMEOUTS.MAX_RETRY_WAIT);
        log.debug(`${operationName} failed, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error(`${operationName} failed after all retries`);
  }
}
