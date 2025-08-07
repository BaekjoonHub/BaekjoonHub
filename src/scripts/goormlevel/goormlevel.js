import PlatformHubBase, { Toast, checkEnable } from "@/commons/platformhub-base.js";
import { SubmissionChecker } from "@/commons/loader-service.js";

import { parseData } from "@/goormlevel/parsing.js";
import uploadOneSolveProblemOnGit from "@/goormlevel/uploadfunctions.js";
import { startUpload, markUploadedCSS } from "@/goormlevel/util.js";
class GoormLevelHub extends PlatformHubBase {
  constructor() {
    super({
      platformName: "구름레벨",
      loaderInterval: 2000,
    });
  }

  async init() {
    const isEnabled = await super.init();
    if (!isEnabled) return;

    if (this.isGoormLevelExamPage()) {
      this.startSubmissionMonitoring();
    }
  }

  /**
   * Check if current page is a GoormLevel exam page
   * @returns {boolean}
   */
  isGoormLevelExamPage() {
    return /^\/exam\/\d+\/[^/]+\/quiz\/1$/.test(this.currentPathname);
  }

  /**
   * Start monitoring for successful submissions
   */
  startSubmissionMonitoring() {
    Toast.info("구름레벨 문제 모니터링을 시작합니다.");

    const checker = SubmissionChecker.createMultiStepChecker([
      () => {
        const activeSubmitTab = this.querySelectorAll("#FrameBody li.nav-item > a.nav-link.active").find((element) => element.textContent === "제출 결과");
        return Boolean(activeSubmitTab);
      },
      () => {
        const result = this.querySelectorAll("#FrameBody div > p[class] > span").find((element) => element.textContent === "정답입니다.");
        return Boolean(result);
      },
    ]);

    const onSuccess = async () => {
      const parsedData = await parseData();

      if (parsedData) {
        startUpload();
        const { examSequence, quizNumber, message, directory, fileName, readme, code } = parsedData;
        const uploadData = { code, readme, directory, fileName, message, examSequence, quizNumber };

        await this.beginUpload(uploadData, uploadOneSolveProblemOnGit, markUploadedCSS);
      }
    };

    this.setupSubmissionMonitoring(checker, onSuccess);
  }
}

new GoormLevelHub();
