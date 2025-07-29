import log from "@/commons/logger.js";
import { checkEnable } from "@/commons/enable.js";

/**
 * Common loader service for monitoring submission results
 */
export class LoaderService {
  constructor(config = {}) {
    this.loader = null;
    this.config = {
      interval: 2000,
      platformName: "Platform",
      ...config,
    };
  }

  /**
   * Start monitoring for successful submissions
   * @param {Function} checkCondition - Function that returns true when submission should be processed
   * @param {Function} onSuccess - Function to call when successful submission is detected
   */
  start(checkCondition, onSuccess) {
    this.loader = setInterval(async () => {
      try {
        const enable = await checkEnable();
        if (!enable) {
          this.stop();
          return;
        }

        if (await checkCondition()) {
          log.info(`정답이 나왔습니다. ${this.config.platformName} 업로드를 시작합니다.`);
          this.stop();
          await onSuccess();
        }
      } catch (error) {
        log.error(`Error in ${this.config.platformName} loader:`, error);
        this.stop();
      }
    }, this.config.interval);
  }

  /**
   * Stop the monitoring loader
   */
  stop() {
    if (this.loader) {
      clearInterval(this.loader);
      this.loader = null;
    }
  }

  /**
   * Check if loader is currently running
   */
  isRunning() {
    return this.loader !== null;
  }
}

/**
 * Condition checker utilities for different platforms
 */
export class SubmissionChecker {
  /**
   * Create a text-based submission checker
   * @param {string} selector - CSS selector for the element to check
   * @param {string|Array<string>} successTexts - Text(s) that indicate success
   * @param {Object} options - Additional options
   */
  static createTextChecker(selector, successTexts, options = {}) {
    const texts = Array.isArray(successTexts) ? successTexts : [successTexts];
    const { caseSensitive = false, exact = false } = options;

    return () => {
      const element = document.querySelector(selector);
      if (!element) return false;

      const content = element.textContent?.trim() || "";
      const checkContent = caseSensitive ? content : content.toLowerCase();

      return texts.some((text) => {
        const checkText = caseSensitive ? text : text.toLowerCase();
        return exact ? checkContent === checkText : checkContent.includes(checkText);
      });
    };
  }

  /**
   * Create a custom condition checker
   * @param {Function} conditionFunction - Custom function that returns boolean
   */
  static createCustomChecker(conditionFunction) {
    return conditionFunction;
  }

  /**
   * Create a multi-step condition checker
   * @param {Array<Function>} conditions - Array of condition functions (all must be true)
   */
  static createMultiStepChecker(conditions) {
    return () => {
      return conditions.every((condition) => condition());
    };
  }

  /**
   * Create a DOM existence checker
   * @param {string} selector - CSS selector for element that should exist
   */
  static createExistenceChecker(selector) {
    return () => {
      return document.querySelector(selector) !== null;
    };
  }
}

/**
 * Factory for creating platform-specific loaders
 */
export class LoaderFactory {
  /**
   * Create a loader instance for a specific platform
   * @param {string} platformName - Name of the platform
   * @param {Object} config - Configuration options
   */
  static create(platformName, config = {}) {
    return new LoaderService({
      platformName,
      ...config,
    });
  }

  /**
   * Create a simple text-based loader
   * @param {string} platformName - Name of the platform
   * @param {string} selector - CSS selector for success element
   * @param {string|Array<string>} successTexts - Text(s) that indicate success
   * @param {Function} onSuccess - Success callback
   * @param {Object} options - Additional options
   */
  static createTextLoader(platformName, selector, successTexts, onSuccess, options = {}) {
    const loader = LoaderFactory.create(platformName, options);
    const checker = SubmissionChecker.createTextChecker(selector, successTexts, options);

    loader.start(checker, onSuccess);
    return loader;
  }
}
