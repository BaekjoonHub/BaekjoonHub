import { isNull, isEmpty, calculateBlobSHA, getVersion } from "@/commons/util.js";
import { getStats, getHook, saveStats, updateLocalStorageStats, getStatsSHAfromPath } from "@/commons/storage.js";
import { Toast } from "@/commons/toast.js";
import { checkEnable } from "@/commons/enable.js";
import { LoaderService, LoaderFactory } from "@/commons/loader-service.js";
import { UploadHandlerFactory } from "@/commons/upload-service.js";
import log from "@/commons/logger.js";

/**
 * Base class for all platform hub implementations
 * Provides common functionality for submission monitoring and upload handling
 */
export default class PlatformHubBase {
  constructor(config = {}) {
    this.loader = null;
    this.currentUrl = window.location.href;
    this.currentPathname = window.location.pathname;
    this.config = {
      loaderInterval: 2000,
      platformName: "unknown",
      ...config,
    };

    this.init();
  }

  /**
   * Initialize the platform hub
   * This method should be overridden by subclasses
   */
  init() {
    log.info(`Initializing ${this.config.platformName} hub`);
    // Subclasses should implement their specific initialization logic
  }

  /**
   * Start the submission monitoring loader
   * @param {Function} checkCondition - Function that returns true when submission should be processed
   * @param {Function} onSuccess - Function to call when successful submission is detected
   */
  startLoader(checkCondition, onSuccess) {
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
   * @param {Function|Object} checker - Checker function or SubmissionChecker instance
   * @param {Function} onSuccess - Success callback
   */
  setupSubmissionMonitoring(checker, onSuccess) {
    const loader = LoaderFactory.create(this.config.platformName, {
      interval: this.config.loaderInterval,
    });
    loader.start(checker, onSuccess);
    this.loaderService = loader;
  }

  /**
   * Generic upload handler creation and execution
   * @param {Function} parseDataFn - Data parsing function
   * @param {Function} uploadFn - Upload function
   * @param {Function} markFn - Mark uploaded function
   * @param {Function} startUploadFn - Start upload function
   * @returns {Promise<Object>} Parsed data
   */
  async createAndExecuteUploadHandler(parseDataFn, uploadFn, markFn, startUploadFn) {
    if (startUploadFn) startUploadFn();

    const uploadHandler = UploadHandlerFactory.create(this.config.platformName, parseDataFn, uploadFn, markFn, startUploadFn);

    return await uploadHandler();
  }

  /**
   * Stop the submission monitoring loader
   */
  stopLoader() {
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
   * @param {Object} data - Parsed problem data
   * @param {Function} uploadFunction - Platform-specific upload function
   * @param {Function} markFunction - Platform-specific mark function
   */
  async beginUpload(data, uploadFunction, markFunction) {
    try {
      log.debug(`${this.config.platformName} data:`, data);

      if (isEmpty(data)) {
        log.debug(`No data to upload for ${this.config.platformName}`);
        return;
      }

      const [stats, hook] = await Promise.all([getStats(), getHook()]);
      const currentVersion = stats.version;

      const shouldUpdateVersion = isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook));

      if (shouldUpdateVersion) {
        await this.versionUpdate();
      }

      const filePath = `${hook}/${data.directory}/${data.fileName}`;
      const [cachedSHA, calcSHA] = await Promise.all([getStatsSHAfromPath(filePath), Promise.resolve(calculateBlobSHA(data.code))]);

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
  async versionUpdate() {
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
   * @param {Array<string|RegExp>} patterns - URL patterns to match
   * @returns {boolean}
   */
  matchesUrl(patterns) {
    return patterns.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(this.currentUrl) || pattern.test(this.currentPathname);
      }
      return this.currentUrl.includes(pattern);
    });
  }

  /**
   * Safely query DOM element with optional chaining
   * @param {string} selector - CSS selector
   * @returns {Element|null}
   */
  querySelector(selector) {
    return document.querySelector(selector);
  }

  /**
   * Safely query multiple DOM elements
   * @param {string} selector - CSS selector
   * @returns {Array<Element>}
   */
  querySelectorAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * Get text content from element with safe fallback
   * @param {string} selector - CSS selector
   * @returns {string}
   */
  getTextContent(selector) {
    const element = this.querySelector(selector);
    return element?.textContent?.trim() || "";
  }
}
