import PlatformHubBase, { Toast, log, type UploadData } from "@/commons/platformhub-base";
import { SubmissionChecker } from "@/commons/loader-service";
import { parseCode, parseData } from "@/swexpertacademy/parsing";
import uploadOneSolveProblemOnGit from "@/swexpertacademy/uploadfunctions";
import { startUpload, markUploadedCSS, getNickname } from "@/swexpertacademy/util";
import { PLATFORMS } from "@/constants/config";

const SWEA_SOLVINGCLUB_CONTEXT_KEY = "swea_solvingclub_context";

interface SolvingClubContext {
  solveclubId: string;
  probBoxId: string;
  timestamp: number;
}

interface SWEAFormData {
  contestProbId: string;
  categoryType: string;
  categoryId: string;
  solveclubId: string | null;
}

class SWExpertAcademyHub extends PlatformHubBase {
  constructor() {
    super({
      platformName: PLATFORMS.SWEXPERTACADEMY,
      loaderInterval: 2000,
    });
  }

  async init(): Promise<boolean> {
    const isEnabled = await super.init();
    if (!isEnabled) return false;

    if (this.isSWEASolvingPage()) {
      this.startSubmissionMonitoring();
    } else if (this.isSWEAResultPage()) {
      await this.parseAndUpload();
    }

    return true;
  }

  private isSWEASolvingPage(): boolean {
    const headerSpan = this.querySelector("header > h1 > span");
    return (
      this.matchesUrl(["/main/solvingProblem/solvingProblem.do"]) &&
      headerSpan?.textContent === "모의 테스트"
    );
  }

  private isSWEAResultPage(): boolean {
    const hasExtensionParam = this.currentUrl.includes("extension=BaekjoonHub");
    const isProblemSolverPage = this.matchesUrl(["/main/code/problem/problemSolver.do"]);
    const isSolvingClubPage = this.matchesUrl(["/main/talk/solvingClub/problemPassedUser.do"]);
    return hasExtensionParam && (isProblemSolverPage || isSolvingClubPage);
  }

  private extractSolveclubIdFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("solveclubId");
    } catch {
      const match = url.match(/solveclubId=([^&]+)/);
      return match ? match[1] : null;
    }
  }

  private saveSolvingClubContext(solveclubId: string, probBoxId: string): void {
    const context: SolvingClubContext = {
      solveclubId,
      probBoxId,
      timestamp: Date.now(),
    };
    try {
      sessionStorage.setItem(SWEA_SOLVINGCLUB_CONTEXT_KEY, JSON.stringify(context));
      log.debug("Saved Solving Club context:", context);
    } catch (e) {
      log.debug("Could not save Solving Club context:", e);
    }
  }

  private loadSolvingClubContext(): SolvingClubContext | null {
    try {
      const stored = sessionStorage.getItem(SWEA_SOLVINGCLUB_CONTEXT_KEY);
      if (!stored) return null;

      const context: SolvingClubContext = JSON.parse(stored);
      if (Date.now() - context.timestamp > 5 * 60 * 1000) {
        sessionStorage.removeItem(SWEA_SOLVINGCLUB_CONTEXT_KEY);
        return null;
      }
      return context;
    } catch {
      return null;
    }
  }

  private checkAndSaveSolvingClubContext(): void {
    const referrer = document.referrer;
    if (!referrer) return;

    if (referrer.includes("/solvingClub/") || referrer.includes("solveclubId=")) {
      const solveclubId = this.extractSolveclubIdFromUrl(referrer);
      if (solveclubId) {
        const probBoxIdMatch = referrer.match(/probBoxId=([^&]+)/);
        const probBoxId = probBoxIdMatch ? probBoxIdMatch[1] : "";
        this.saveSolvingClubContext(solveclubId, probBoxId);
        log.info("Detected Solving Club context from referrer:", { solveclubId, probBoxId });
      }
    }
  }

  private getSolveclubId(): string | null {
    const solveclubIdEl = document.querySelector<HTMLInputElement>(
      "form[name='mainForm'] input[name='solveclubId'], " +
      "input[name='solveclubId'], " +
      "#solveclubId"
    );
    if (solveclubIdEl?.value) {
      log.debug("solveclubId found in form input:", solveclubIdEl.value);
      return solveclubIdEl.value;
    }

    const urlSolveclubId = this.extractSolveclubIdFromUrl(window.location.href);
    if (urlSolveclubId) {
      log.debug("solveclubId found in URL:", urlSolveclubId);
      return urlSolveclubId;
    }

    const referrer = document.referrer;
    if (referrer) {
      const referrerSolveclubId = this.extractSolveclubIdFromUrl(referrer);
      if (referrerSolveclubId) {
        log.debug("solveclubId found in referrer:", referrerSolveclubId);
        return referrerSolveclubId;
      }
    }

    const savedContext = this.loadSolvingClubContext();
    if (savedContext?.solveclubId) {
      log.debug("solveclubId found in saved context:", savedContext.solveclubId);
      return savedContext.solveclubId;
    }

    try {
      const mainForm = (window as unknown as { mainForm?: HTMLFormElement }).mainForm;
      if (mainForm) {
        const formElement = mainForm.elements.namedItem("solveclubId") as HTMLInputElement | null;
        if (formElement?.value) {
          log.debug("solveclubId found in mainForm:", formElement.value);
          return formElement.value;
        }
      }
    } catch (e) {
      log.debug("Could not access mainForm:", e);
    }

    log.debug("No solveclubId found from any source");
    return null;
  }

  private getFormData(): SWEAFormData {
    const contestProbIdEl = document.querySelector<HTMLInputElement>("#contestProbId");
    const categoryTypeEl = document.querySelector<HTMLInputElement>(
      "form[name='mainForm'] input[name='categoryType'], input[name='categoryType'], #categoryType"
    );
    const categoryIdEl = document.querySelector<HTMLInputElement>(
      "form[name='mainForm'] input[name='categoryId'], input[name='categoryId'], #categoryId"
    );

    const formData: SWEAFormData = {
      contestProbId: contestProbIdEl?.value || "",
      categoryType: categoryTypeEl?.value || "",
      categoryId: categoryIdEl?.value || "",
      solveclubId: this.getSolveclubId(),
    };

    log.debug("Form data:", formData);
    return formData;
  }

  private disableModalConfirmButton(): void {
    const confirmButtons = document.querySelectorAll<HTMLButtonElement>(
      "div.popup_layer.show button, div.popup_layer.show .btn"
    );
    confirmButtons.forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    });
  }

  private async parseAndUpload(): Promise<void> {
    try {
      startUpload();

      const parsedData = await parseData();
      if (!parsedData) {
        log.error("parseData 실패: 데이터를 파싱할 수 없습니다.");
        return;
      }

      await this.beginUpload(parsedData as unknown as UploadData, uploadOneSolveProblemOnGit, markUploadedCSS);
    } catch (error) {
      log.error("Error in SWEA parseAndUpload:", error);
    }
  }

  private startSubmissionMonitoring(): void {
    this.checkAndSaveSolvingClubContext();
    Toast.info("SW Expert Academy 문제 모니터링을 시작합니다.", 3000);

    const checker = SubmissionChecker.createTextChecker(
      "div.popup_layer.show > div > p.txt",
      "pass입니다",
      { caseSensitive: false }
    );

    const onSuccess = async (): Promise<void> => {
      log.info("정답이 나왔습니다. 코드를 저장하고 결과 페이지로 이동합니다.");

      try {
        this.disableModalConfirmButton();

        const codeResult = await parseCode();
        if (!codeResult) {
          log.error("코드 파싱에 실패했습니다.");
          return;
        }

        const formData = this.getFormData();
        const redirectUrl = this.buildRedirectUrl(codeResult.contestProbId, formData);
        log.info("결과 페이지로 이동:", redirectUrl);
        window.location.href = redirectUrl;
      } catch (error) {
        log.error("SWEA 제출 처리 중 오류:", error);
      }
    };

    this.setupSubmissionMonitoring(checker, onSuccess);
  }

  private buildRedirectUrl(contestProbId: string, formData: SWEAFormData): string {
    const origin = window.location.origin;

    if (formData.solveclubId) {
      const baseUrl = `${origin}/main/talk/solvingClub/problemPassedUser.do`;
      const params = new URLSearchParams({
        contestProbId,
        solveclubId: formData.solveclubId,
        probBoxId: formData.categoryId,
        extension: "BaekjoonHub",
      });
      return `${baseUrl}?${params.toString()}`;
    }

    const baseUrl = `${origin}/main/code/problem/problemSolver.do`;
    const params = new URLSearchParams({
      contestProbId,
      nickName: getNickname(),
      extension: "BaekjoonHub",
    });
    return `${baseUrl}?${params.toString()}`;
  }
}

new SWExpertAcademyHub();
