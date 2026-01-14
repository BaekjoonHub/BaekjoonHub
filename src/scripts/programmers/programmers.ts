/**
 * Programmers Hub main entry point
 * Content script for programmers.co.kr
 */
import PlatformHubBase, { Toast, checkEnable, type UploadData } from "@/commons/platformhub-base";
import { SubmissionChecker } from "@/commons/loader-service";
import { parseData } from "@/programmers/parsing";
import uploadOneSolveProblemOnGit from "@/programmers/uploadfunctions";
import { startUpload, markUploadedCSS } from "@/programmers/util";
import { PLATFORMS } from "@/constants/config";

/**
 * ProgrammersHub class for handling Programmers submissions
 * Extends PlatformHubBase for common platform functionality
 */
class ProgrammersHub extends PlatformHubBase {
  constructor() {
    super({
      platformName: PLATFORMS.PROGRAMMERS,
      loaderInterval: 2000,
    });
  }

  /**
   * Initialize the ProgrammersHub extension
   */
  async init(): Promise<boolean> {
    const isEnabled = await super.init();
    if (!isEnabled) return false;

    if (this.isProgrammersLessonPage()) {
      this.startSubmissionMonitoring();
    }

    return true;
  }

  /**
   * Check if current page is a Programmers lesson page
   * @returns Whether current page is a lesson page
   */
  private isProgrammersLessonPage(): boolean {
    return this.matchesUrl(["/learn/courses/30"]) && this.currentUrl.includes("lessons");
  }

  /**
   * Start monitoring for successful submissions
   */
  private startSubmissionMonitoring(): void {
    Toast.info("프로그래머스 문제 모니터링을 시작합니다.", 3000);

    const checker = SubmissionChecker.createTextChecker("div.modal-header > h4", "정답");

    const onSuccess = async (): Promise<void> => {
      const result = await this.createAndExecuteUploadHandler(
        parseData,
        uploadOneSolveProblemOnGit,
        markUploadedCSS,
        startUpload
      );

      if (result?.success && result?.data) {
        await this.beginUpload(result.data as UploadData, uploadOneSolveProblemOnGit, markUploadedCSS);
      }
    };

    this.setupSubmissionMonitoring(checker, onSuccess);
  }
}

// Initialize ProgrammersHub
new ProgrammersHub();
