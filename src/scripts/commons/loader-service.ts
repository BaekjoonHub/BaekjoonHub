/**
 * Common loader service for monitoring submission results
 */
import log from "@/commons/logger";
import { checkEnable } from "@/commons/enable";
import type { CheckCondition, SuccessCallback, SubmissionCheckerOptions } from "@/types/platform";

// Loader configuration interface
interface LoaderConfig {
  interval: number;
  platformName: string;
}

/**
 * Common loader service for monitoring submission results
 */
export class LoaderService {
  private loader: ReturnType<typeof setInterval> | null = null;
  private config: LoaderConfig;

  constructor(config: Partial<LoaderConfig> = {}) {
    this.config = {
      interval: 2000,
      platformName: "Platform",
      ...config,
    };
  }

  /**
   * Start monitoring for successful submissions
   * @param checkCondition - Function that returns true when submission should be processed
   * @param onSuccess - Function to call when successful submission is detected
   */
  start(checkCondition: CheckCondition, onSuccess: SuccessCallback): void {
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
  stop(): void {
    if (this.loader) {
      clearInterval(this.loader);
      this.loader = null;
    }
  }

  /**
   * Check if loader is currently running
   */
  isRunning(): boolean {
    return this.loader !== null;
  }
}

/**
 * Condition checker utilities for different platforms
 */
export class SubmissionChecker {
  /**
   * Create a text-based submission checker
   * @param selector - CSS selector for the element to check
   * @param successTexts - Text(s) that indicate success
   * @param options - Additional options
   */
  static createTextChecker(
    selector: string,
    successTexts: string | string[],
    options: SubmissionCheckerOptions & { exact?: boolean } = {}
  ): CheckCondition {
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
   * @param conditionFunction - Custom function that returns boolean
   */
  static createCustomChecker(conditionFunction: CheckCondition): CheckCondition {
    return conditionFunction;
  }

  /**
   * Create a multi-step condition checker
   * @param conditions - Array of condition functions (all must be true)
   */
  static createMultiStepChecker(conditions: CheckCondition[]): CheckCondition {
    return () => {
      return conditions.every((condition) => condition());
    };
  }

  /**
   * Create a DOM existence checker
   * @param selector - CSS selector for element that should exist
   */
  static createExistenceChecker(selector: string): CheckCondition {
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
   * @param platformName - Name of the platform
   * @param config - Configuration options
   */
  static create(platformName: string, config: Partial<LoaderConfig> = {}): LoaderService {
    return new LoaderService({
      platformName,
      ...config,
    });
  }

  /**
   * Create a simple text-based loader
   * @param platformName - Name of the platform
   * @param selector - CSS selector for success element
   * @param successTexts - Text(s) that indicate success
   * @param onSuccess - Success callback
   * @param options - Additional options
   */
  static createTextLoader(
    platformName: string,
    selector: string,
    successTexts: string | string[],
    onSuccess: SuccessCallback,
    options: Partial<LoaderConfig> & SubmissionCheckerOptions & { exact?: boolean } = {}
  ): LoaderService {
    const loader = LoaderFactory.create(platformName, options);
    const checker = SubmissionChecker.createTextChecker(selector, successTexts, options);

    loader.start(checker, onSuccess);
    return loader;
  }
}
