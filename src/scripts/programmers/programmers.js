import PlatformHubBase, { Toast, checkEnable } from "@/commons/platformhub-base.js";
import { SubmissionChecker } from "@/commons/loader-service.js";

import { parseData } from "@/programmers/parsing.js";
import uploadOneSolveProblemOnGit from "@/programmers/uploadfunctions.js";
import { startUpload, markUploadedCSS } from "@/programmers/util.js";

class ProgrammersHub extends PlatformHubBase {
  constructor() {
    super({
      platformName: "프로그래머스",
      loaderInterval: 2000,
    });
  }

  async init() {
    const isEnabled = await super.init();
    if (!isEnabled) return;

    if (this.isProgrammersLessonPage()) {
      this.startSubmissionMonitoring();
    }
  }

  /**
   * Check if current page is a Programmers lesson page
   * @returns {boolean}
   */
  isProgrammersLessonPage() {
    return this.matchesUrl(["/learn/courses/30"]) && this.currentUrl.includes("lessons");
  }

  /**
   * Start monitoring for successful submissions
   */
  startSubmissionMonitoring() {
    Toast.info("프로그래머스 문제 모니터링을 시작합니다.");

    const checker = SubmissionChecker.createTextChecker("div.modal-header > h4", "정답");

    const onSuccess = async () => {
      const bojData = await this.createAndExecuteUploadHandler(parseData, uploadOneSolveProblemOnGit, markUploadedCSS, startUpload);
      await this.beginUpload(bojData, uploadOneSolveProblemOnGit, markUploadedCSS);
    };

    this.setupSubmissionMonitoring(checker, onSuccess);
  }
}

new ProgrammersHub();
