import PlatformHubBase, { Toast, checkEnable, log } from "@/commons/platformhub-base.js";
import { SubmissionChecker } from "@/commons/loader-service.js";

import { parseCode, parseData } from "@/swexpertacademy/parsing.js";
import uploadOneSolveProblemOnGit from "@/swexpertacademy/uploadfunctions.js";
import { startUpload, markUploadedCSS, getNickname, makeSubmitButton } from "@/swexpertacademy/util.js";

class SWExpertAcademyHub extends PlatformHubBase {
  constructor() {
    super({
      platformName: "SW Expert Academy",
      loaderInterval: 2000,
    });
  }

  async init() {
    const isEnabled = await super.init();
    if (!isEnabled) return;

    if (this.isSWEASolvingPage()) {
      this.startSubmissionMonitoring();
    } else if (this.isSWEAProblemSolverPage()) {
      this.parseAndUpload();
    }
  }

  /**
   * Check if current page is SWEA solving page
   * @returns {boolean}
   */
  isSWEASolvingPage() {
    const headerSpan = this.querySelector("header > h1 > span");
    return this.matchesUrl(["/main/solvingProblem/solvingProblem.do"]) && headerSpan?.textContent === "모의 테스트";
  }

  /**
   * Check if current page is SWEA problem solver page
   * @returns {boolean}
   */
  isSWEAProblemSolverPage() {
    return this.matchesUrl(["/main/code/problem/problemSolver.do"]) && this.currentUrl.includes("extension=BaekjoonHub");
  }

  /**
   * Parse and upload data directly (for problem solver page)
   */
  async parseAndUpload() {
    try {
      const bojData = await this.createAndExecuteUploadHandler(parseData, uploadOneSolveProblemOnGit, markUploadedCSS, startUpload);
      await this.beginUpload(bojData, uploadOneSolveProblemOnGit, markUploadedCSS);
    } catch (error) {
      log.error("Error in SWEA parseAndUpload:", error);
    }
  }

  /**
   * Start monitoring for successful submissions
   */
  startSubmissionMonitoring() {
    Toast.info("SW Expert Academy 문제 모니터링을 시작합니다.");

    const checker = SubmissionChecker.createTextChecker("div.popup_layer.show > div > p.txt", "pass입니다", { caseSensitive: false });

    const onSuccess = async () => {
      log.info("정답이 나왔습니다. 코드를 파싱합니다");

      try {
        const { contestProbId } = await parseCode();
        const redirectUrl = this.buildRedirectUrl(contestProbId);
        await makeSubmitButton(redirectUrl);
      } catch (error) {
        log.error("Error processing SWEA success:", error);
      }
    };

    this.setupSubmissionMonitoring(checker, onSuccess);
  }

  /**
   * Build redirect URL for SWEA submission
   * @param {string} contestProbId - Contest problem ID
   * @returns {string} - Redirect URL
   */
  buildRedirectUrl(contestProbId) {
    const baseUrl = `${window.location.origin}/main/code/problem/problemSolver.do`;
    const params = new URLSearchParams({
      contestProbId,
      nickName: getNickname(),
      extension: "BaekjoonHub",
    });
    return `${baseUrl}?${params.toString()}`;
  }
}

new SWExpertAcademyHub();
