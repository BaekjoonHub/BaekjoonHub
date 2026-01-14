/**
 * BaekjoonHub Settings Entry Point
 * Handles settings page UI, repository connection, and template builder
 */
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "./scripts/commons/storage";
import { STORAGE_KEYS } from "./scripts/constants/registry";
import beginOAuth2 from "./scripts/commons/oauth2";
import { parseTemplateString, TextTransforms as SafeTextTransforms } from "safe-template-parser";
import { getTextTransforms } from "./scripts/commons/text-transforms";
import log from "./scripts/commons/logger";
import { AIReviewService, DEFAULT_PROMPT_TEMPLATE } from "./scripts/commons/ai-review";

// Interfaces
interface AppSettings {
  connected: boolean;
  repoName: string;
  autoUpload: boolean;
  useCustomTemplate: boolean;
  templateString: string;
  // AI Review settings
  aiReviewEnabled: boolean;
  openaiToken: string;
  aiPrompt: string;
}

interface GitHubRepository {
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
}

interface GitHubUserInfo {
  username: string;
  repositories: GitHubRepository[];
}

interface SettingsElements {
  connectionStatus: HTMLElement | null;
  errorMessage: HTMLElement | null;
  successMessage: HTMLElement | null;
  setupSection: HTMLElement | null;
  settingsSection: HTMLElement | null;
  managementSection: HTMLElement | null;
  repoType: HTMLSelectElement | null;
  repoName: HTMLInputElement | null;
  repoSelect: HTMLSelectElement | null;
  connectRepo: HTMLButtonElement | null;
  autoUpload: HTMLInputElement | null;
  useCustomTemplate: HTMLInputElement | null;
  customTemplateInput: HTMLElement | null;
  templateString: HTMLInputElement | null;
  templatePreview: HTMLElement | null;
  unlinkRepo: HTMLButtonElement | null;
  saveTemplate: HTMLButtonElement | null;
  resetTemplate: HTMLButtonElement | null;
  // AI Review elements
  aiReviewSection: HTMLElement | null;
  aiReviewEnabled: HTMLInputElement | null;
  aiReviewSettings: HTMLElement | null;
  openaiToken: HTMLInputElement | null;
  toggleTokenVisibility: HTMLButtonElement | null;
  saveAISettings: HTMLButtonElement | null;
  testAIConnection: HTMLButtonElement | null;
  aiPrompt: HTMLTextAreaElement | null;
  aiPromptVariables: HTMLElement | null;
  savePrompt: HTMLButtonElement | null;
  resetPrompt: HTMLButtonElement | null;
}

// Settings state
let appSettings: AppSettings = {
  connected: false,
  repoName: "",
  autoUpload: true,
  useCustomTemplate: false,
  templateString: "{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}",
  // AI Review defaults
  aiReviewEnabled: false,
  openaiToken: "",
  aiPrompt: "",
};

// GitHub user info
let githubUserInfo: GitHubUserInfo = {
  username: "",
  repositories: [],
};

// DOM elements (initialized after DOM load)
let elements: SettingsElements;

/**
 * Initialize DOM elements
 */
function initElements(): void {
  elements = {
    connectionStatus: document.getElementById("connectionStatus"),
    errorMessage: document.getElementById("errorMessage"),
    successMessage: document.getElementById("successMessage"),
    setupSection: document.getElementById("setupSection"),
    settingsSection: document.getElementById("settingsSection"),
    managementSection: document.getElementById("managementSection"),
    repoType: document.getElementById("repoType") as HTMLSelectElement | null,
    repoName: document.getElementById("repoName") as HTMLInputElement | null,
    repoSelect: document.getElementById("repoSelect") as HTMLSelectElement | null,
    connectRepo: document.getElementById("connectRepo") as HTMLButtonElement | null,
    autoUpload: document.getElementById("autoUpload") as HTMLInputElement | null,
    useCustomTemplate: document.getElementById("useCustomTemplate") as HTMLInputElement | null,
    customTemplateInput: document.getElementById("customTemplateInput"),
    templateString: document.getElementById("templateString") as HTMLInputElement | null,
    templatePreview: document.getElementById("templatePreview"),
    unlinkRepo: document.getElementById("unlinkRepo") as HTMLButtonElement | null,
    saveTemplate: document.getElementById("saveTemplate") as HTMLButtonElement | null,
    resetTemplate: document.getElementById("resetTemplate") as HTMLButtonElement | null,
    // AI Review elements
    aiReviewSection: document.getElementById("aiReviewSection"),
    aiReviewEnabled: document.getElementById("aiReviewEnabled") as HTMLInputElement | null,
    aiReviewSettings: document.getElementById("aiReviewSettings"),
    openaiToken: document.getElementById("openaiToken") as HTMLInputElement | null,
    toggleTokenVisibility: document.getElementById("toggleTokenVisibility") as HTMLButtonElement | null,
    saveAISettings: document.getElementById("saveAISettings") as HTMLButtonElement | null,
    testAIConnection: document.getElementById("testAIConnection") as HTMLButtonElement | null,
    aiPrompt: document.getElementById("aiPrompt") as HTMLTextAreaElement | null,
    aiPromptVariables: document.getElementById("aiPromptVariables"),
    savePrompt: document.getElementById("savePrompt") as HTMLButtonElement | null,
    resetPrompt: document.getElementById("resetPrompt") as HTMLButtonElement | null,
  };
}

/**
 * Open repository URL in new tab
 */
function openRepositoryURL(repoName: string): void {
  if (repoName && repoName.includes("/")) {
    const githubURL = `https://github.com/${repoName}`;
    window.open(githubURL, "_blank");
    log.debug("Opening repository URL:", githubURL);
  } else {
    log.error("Invalid repository name:", repoName);
  }
}

/**
 * Show message notification
 */
function showMessage(type: "error" | "success", text: string, autoHide = true): void {
  const messageEl = elements[`${type}Message` as keyof SettingsElements] as HTMLElement | null;
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.style.display = "block";

  if (autoHide) {
    setTimeout(() => {
      messageEl.style.display = "none";
    }, 5000);
  }
}

/**
 * Hide message notification
 */
function hideMessage(type: "error" | "success"): void {
  const messageEl = elements[`${type}Message` as keyof SettingsElements] as HTMLElement | null;
  if (messageEl) {
    messageEl.style.display = "none";
  }
}

/**
 * Update connection status UI
 */
function updateConnectionStatus(): void {
  if (!elements.connectionStatus) return;

  if (appSettings.connected) {
    elements.connectionStatus.innerHTML = `
      <div class="status-connected">
        <a class="repo-info" href="https://github.com/${appSettings.repoName}" target="_blank" title="클릭하여 GitHub 저장소로 이동">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <strong>연결됨:</strong> ${appSettings.repoName}
        </a>
      </div>
    `;
    if (elements.setupSection) elements.setupSection.style.display = "none";
    if (elements.settingsSection) elements.settingsSection.style.display = "block";
    if (elements.aiReviewSection) elements.aiReviewSection.style.display = "block";
    if (elements.managementSection) elements.managementSection.style.display = "block";
  } else {
    elements.connectionStatus.innerHTML = `
      <div class="status-disconnected">
        GitHub 저장소가 연결되지 않았습니다. 아래에서 저장소를 설정해주세요.
      </div>
    `;
    if (elements.setupSection) elements.setupSection.style.display = "block";
    if (elements.settingsSection) elements.settingsSection.style.display = "none";
    if (elements.aiReviewSection) elements.aiReviewSection.style.display = "none";
    if (elements.managementSection) elements.managementSection.style.display = "none";
  }
}

/**
 * Detect and set mode from storage
 */
async function detectAndSetMode(): Promise<void> {
  try {
    const data = await getObjectFromLocalStorage<Record<string, unknown>>([
      STORAGE_KEYS.MODE_TYPE,
      STORAGE_KEYS.HOOK,
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.ENABLE,
      STORAGE_KEYS.USE_CUSTOM_TEMPLATE,
      STORAGE_KEYS.DIR_TEMPLATE,
      STORAGE_KEYS.AI_REVIEW_ENABLED,
      STORAGE_KEYS.OPENAI_TOKEN,
      STORAGE_KEYS.AI_REVIEW_PROMPT,
    ]);

    const modeType = data?.[STORAGE_KEYS.MODE_TYPE] as string | undefined;
    const hook = data?.[STORAGE_KEYS.HOOK] as string | undefined;
    const token = data?.[STORAGE_KEYS.TOKEN] as string | undefined;
    const enabled = data?.[STORAGE_KEYS.ENABLE] as boolean | undefined;
    const useCustomTemplate = data?.[STORAGE_KEYS.USE_CUSTOM_TEMPLATE] as boolean | undefined;
    const dirTemplate = data?.[STORAGE_KEYS.DIR_TEMPLATE] as string | undefined;
    const aiReviewEnabled = data?.[STORAGE_KEYS.AI_REVIEW_ENABLED] as boolean | undefined;
    const openaiToken = data?.[STORAGE_KEYS.OPENAI_TOKEN] as string | undefined;
    const aiPrompt = data?.[STORAGE_KEYS.AI_REVIEW_PROMPT] as string | undefined;

    if (modeType === "commit" && hook) {
      if (!token) {
        showAuthorizationError();
        return;
      }

      appSettings.connected = true;
      appSettings.repoName = hook;
      appSettings.autoUpload = enabled !== false;
      appSettings.useCustomTemplate = useCustomTemplate || false;
      appSettings.templateString = dirTemplate || "{{language}}/{{level}}/{{problemId}}. {{title}}";
      appSettings.aiReviewEnabled = aiReviewEnabled || false;
      appSettings.openaiToken = openaiToken || "";
      appSettings.aiPrompt = aiPrompt || "";

      // ENABLE이 설정되지 않은 기존 사용자를 위해 자동으로 초기화
      if (enabled === undefined) {
        await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: true });
      }

      updateConnectionStatus();
      updateFormValues();
    } else {
      appSettings.connected = false;
      updateConnectionStatus();
    }
  } catch (error) {
    log.error("Mode detection error:", error);
    appSettings.connected = false;
    updateConnectionStatus();
  }
}

/**
 * Check GitHub token validity
 */
async function checkGitHubToken(): Promise<string | null> {
  try {
    const token = await getObjectFromLocalStorage(STORAGE_KEYS.TOKEN) as string | null;

    if (!token || token.trim() === "") {
      return null;
    }

    return token;
  } catch (error) {
    log.error("Token check error:", error);
    return null;
  }
}

/**
 * Show GitHub auth required notice
 */
function showGitHubAuthRequired(): void {
  if (!elements.errorMessage) return;

  const authMessage = `
    <div class="auth-required-notice">
      <div class="notice-icon">🔐</div>
      <div class="notice-content">
        <h3>GitHub 인증이 필요합니다</h3>
        <p>저장소를 연결하려면 먼저 GitHub 계정 인증을 완료해야 합니다.</p>
        <button id="authorize_button" class="button button-primary">
          <span>🔗</span> GitHub 인증하기
        </button>
      </div>
    </div>
  `;

  elements.errorMessage.innerHTML = authMessage;
  elements.errorMessage.style.display = "block";

  const authorizeButton = document.getElementById("authorize_button");
  if (authorizeButton) {
    authorizeButton.addEventListener("click", () => {
      hideMessage("error");
      beginOAuth2();
    });
  }
}

/**
 * Show authorization error
 */
function showAuthorizationError(): void {
  if (!elements.errorMessage) return;

  elements.errorMessage.innerHTML =
    'GitHub 계정 인증이 필요합니다. <button id="authorize_button" class="button button-primary">인증하기</button>';
  elements.errorMessage.style.display = "block";

  const authorizeButton = document.getElementById("authorize_button");
  if (authorizeButton) {
    authorizeButton.addEventListener("click", beginOAuth2);
  }
}

/**
 * Update form values from settings
 */
function updateFormValues(): void {
  if (elements.autoUpload) {
    elements.autoUpload.checked = appSettings.autoUpload;
  }
  if (elements.useCustomTemplate) {
    elements.useCustomTemplate.checked = appSettings.useCustomTemplate;
    if (elements.customTemplateInput) {
      elements.customTemplateInput.style.display = appSettings.useCustomTemplate ? "block" : "none";
    }
  }
  if (elements.templateString) {
    elements.templateString.value = appSettings.templateString;
  }

  // AI Review settings
  if (elements.aiReviewEnabled) {
    elements.aiReviewEnabled.checked = appSettings.aiReviewEnabled;
    if (elements.aiReviewSettings) {
      elements.aiReviewSettings.style.display = appSettings.aiReviewEnabled ? "block" : "none";
    }
  }
  if (elements.openaiToken) {
    elements.openaiToken.value = appSettings.openaiToken;
  }
  if (elements.aiPrompt) {
    elements.aiPrompt.value = appSettings.aiPrompt || DEFAULT_PROMPT_TEMPLATE;
  }
}

/**
 * Fetch GitHub user info and repositories
 */
async function fetchGitHubUserInfo(): Promise<GitHubUserInfo | null> {
  try {
    const data = await getObjectFromLocalStorage<Record<string, unknown>>([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USERNAME]);
    const token = data?.[STORAGE_KEYS.TOKEN] as string | undefined;
    const username = data?.[STORAGE_KEYS.USERNAME] as string | undefined;

    if (!token || !username) {
      return null;
    }

    githubUserInfo.username = username;

    const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (response.ok) {
      const repos = await response.json();
      githubUserInfo.repositories = repos.map((repo: {
        name: string;
        full_name: string;
        description: string | null;
        private: boolean;
      }) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
      }));
    }

    return githubUserInfo;
  } catch (error) {
    log.error("GitHub user info fetch error:", error);
    return null;
  }
}

/**
 * Update repository select dropdown
 */
function updateRepositorySelect(): void {
  if (!elements.repoSelect) return;

  // Remove existing options except first
  while (elements.repoSelect.options.length > 1) {
    elements.repoSelect.removeChild(elements.repoSelect.lastChild!);
  }

  // Add new options
  githubUserInfo.repositories.forEach((repo) => {
    const option = document.createElement("option");
    option.value = repo.fullName;
    option.textContent = `${repo.name} ${repo.private ? "(비공개)" : ""}`;
    if (repo.description) {
      option.textContent += ` - ${repo.description}`;
    }
    elements.repoSelect!.appendChild(option);
  });
}

/**
 * Handle repository type change
 */
async function handleRepoTypeChange(): Promise<void> {
  if (!elements.repoType) return;

  const repoType = elements.repoType.value;

  if (repoType === "new") {
    if (elements.repoName) elements.repoName.style.display = "block";
    if (elements.repoSelect) elements.repoSelect.style.display = "none";

    const userInfo = await fetchGitHubUserInfo();
    if (elements.repoName) {
      elements.repoName.value = userInfo?.username ? `${userInfo.username}/TIL` : "username/TIL";
    }
  } else if (repoType === "existing") {
    const token = await checkGitHubToken();
    if (!token) {
      showGitHubAuthRequired();
      elements.repoType.value = "";
      return;
    }

    if (elements.repoName) elements.repoName.style.display = "none";
    if (elements.repoSelect) elements.repoSelect.style.display = "block";

    const userInfo = await fetchGitHubUserInfo();
    if (userInfo) {
      updateRepositorySelect();
    } else {
      showMessage("error", "GitHub 사용자 정보를 가져올 수 없습니다. 다시 로그인해 주세요.");
    }
  } else {
    if (elements.repoName) {
      elements.repoName.style.display = "none";
      elements.repoName.value = "";
    }
    if (elements.repoSelect) {
      elements.repoSelect.style.display = "none";
      elements.repoSelect.value = "";
    }
  }

  validateForm();
}

/**
 * Handle repository select change
 */
function handleRepoSelect(): void {
  if (!elements.repoSelect || !elements.repoName) return;

  const selectedRepo = elements.repoSelect.value;
  if (selectedRepo) {
    elements.repoName.value = selectedRepo;
  }
  validateForm();
}

/**
 * Validate form inputs
 */
function validateForm(): boolean {
  if (!elements.repoType || !elements.connectRepo) return false;

  const repoType = elements.repoType.value;
  let repoName = "";

  if (repoType === "new") {
    repoName = elements.repoName?.value || "";
  } else if (repoType === "existing") {
    repoName = elements.repoSelect?.value || elements.repoName?.value || "";
  }

  const isValid = Boolean(repoType && repoName && repoName.includes("/"));
  elements.connectRepo.disabled = !isValid;

  return isValid;
}

/**
 * Handle repository connection
 */
async function handleRepoConnection(): Promise<void> {
  const token = await checkGitHubToken();
  if (!token) {
    showGitHubAuthRequired();
    return;
  }

  if (!validateForm()) {
    showMessage("error", "모든 필드를 올바르게 입력해주세요.");
    return;
  }

  if (!elements.repoType || !elements.connectRepo) return;

  const repoType = elements.repoType.value;
  let repoName = "";

  if (repoType === "new") {
    repoName = elements.repoName?.value || "";
  } else if (repoType === "existing") {
    repoName = elements.repoSelect?.value || elements.repoName?.value || "";
  }

  try {
    hideMessage("error");
    elements.connectRepo.disabled = true;
    elements.connectRepo.textContent = "연결 중...";

    await saveObjectInLocalStorage({
      [STORAGE_KEYS.MODE_TYPE]: "commit",
      [STORAGE_KEYS.HOOK]: repoName,
      [STORAGE_KEYS.ENABLE]: true,
    });

    await beginOAuth2();
  } catch (error) {
    log.error("Repository connection error:", error);
    showMessage("error", "저장소 연결에 실패했습니다. 다시 시도해주세요.");
    elements.connectRepo.disabled = false;
    elements.connectRepo.textContent = "연결하기";
  }
}

/**
 * Handle repository disconnection
 */
async function handleRepoDisconnection(): Promise<void> {
  if (!confirm("정말로 저장소 연결을 해제하시겠습니까?")) {
    return;
  }

  try {
    await saveObjectInLocalStorage({
      [STORAGE_KEYS.MODE_TYPE]: "",
      [STORAGE_KEYS.HOOK]: "",
      [STORAGE_KEYS.TOKEN]: "",
      [STORAGE_KEYS.USERNAME]: "",
      [STORAGE_KEYS.ORG_OPTION]: "",
    });

    appSettings.connected = false;
    appSettings.repoName = "";

    updateConnectionStatus();
    showMessage("success", "저장소 연결이 해제되었습니다.");
  } catch (error) {
    log.error("Disconnection error:", error);
    showMessage("error", "연결 해제에 실패했습니다.");
  }
}

/**
 * Save settings to storage
 */
async function saveSettings(): Promise<void> {
  try {
    await saveObjectInLocalStorage({
      [STORAGE_KEYS.ENABLE]: appSettings.autoUpload,
      [STORAGE_KEYS.USE_CUSTOM_TEMPLATE]: appSettings.useCustomTemplate,
      [STORAGE_KEYS.DIR_TEMPLATE]: appSettings.templateString,
    });
  } catch (error) {
    log.error("Settings save error:", error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  // Repository type change
  if (elements.repoType) {
    elements.repoType.addEventListener("change", handleRepoTypeChange);
  }

  // Repository select change
  if (elements.repoSelect) {
    elements.repoSelect.addEventListener("change", handleRepoSelect);
  }

  // Form validation
  if (elements.repoName) {
    elements.repoName.addEventListener("input", validateForm);
  }

  // Repository connect/disconnect
  if (elements.connectRepo) {
    elements.connectRepo.addEventListener("click", handleRepoConnection);
  }
  if (elements.unlinkRepo) {
    elements.unlinkRepo.addEventListener("click", handleRepoDisconnection);
  }

  // Settings changes
  if (elements.autoUpload) {
    elements.autoUpload.addEventListener("change", async (e) => {
      appSettings.autoUpload = (e.target as HTMLInputElement).checked;
      await saveSettings();
    });
  }

  if (elements.useCustomTemplate) {
    elements.useCustomTemplate.addEventListener("change", async (e) => {
      appSettings.useCustomTemplate = (e.target as HTMLInputElement).checked;
      if (elements.customTemplateInput) {
        elements.customTemplateInput.style.display = appSettings.useCustomTemplate ? "block" : "none";
      }
      await saveSettings();
    });
  }

  if (elements.templateString) {
    elements.templateString.addEventListener("input", (e) => {
      appSettings.templateString = (e.target as HTMLInputElement).value;
    });
  }

  // AI Review event listeners
  if (elements.aiReviewEnabled) {
    elements.aiReviewEnabled.addEventListener("change", async (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      appSettings.aiReviewEnabled = enabled;
      if (elements.aiReviewSettings) {
        elements.aiReviewSettings.style.display = enabled ? "block" : "none";
      }
      await saveObjectInLocalStorage({ [STORAGE_KEYS.AI_REVIEW_ENABLED]: enabled });
    });
  }

  // Toggle token visibility
  if (elements.toggleTokenVisibility && elements.openaiToken) {
    elements.toggleTokenVisibility.addEventListener("click", () => {
      const isPassword = elements.openaiToken!.type === "password";
      elements.openaiToken!.type = isPassword ? "text" : "password";
      elements.toggleTokenVisibility!.textContent = isPassword ? "숨기기" : "보기";
    });
  }

  // Save AI settings (OpenAI token)
  if (elements.saveAISettings) {
    elements.saveAISettings.addEventListener("click", async () => {
      const token = elements.openaiToken?.value || "";
      appSettings.openaiToken = token;
      await saveObjectInLocalStorage({ [STORAGE_KEYS.OPENAI_TOKEN]: token });
      showMessage("success", "API 키가 저장되었습니다.");
    });
  }

  // Test AI connection
  if (elements.testAIConnection) {
    elements.testAIConnection.addEventListener("click", async () => {
      const token = elements.openaiToken?.value || "";
      if (!token) {
        showMessage("error", "API 키를 먼저 입력해주세요.");
        return;
      }

      elements.testAIConnection!.disabled = true;
      elements.testAIConnection!.textContent = "테스트 중...";

      const result = await AIReviewService.testConnection(token);

      elements.testAIConnection!.disabled = false;
      elements.testAIConnection!.textContent = "연결 테스트";

      if (result.success) {
        showMessage("success", "OpenAI API 연결 성공!");
      } else {
        showMessage("error", `연결 실패: ${result.error}`);
      }
    });
  }

  // Save AI prompt
  if (elements.savePrompt) {
    elements.savePrompt.addEventListener("click", async () => {
      const prompt = elements.aiPrompt?.value || "";
      appSettings.aiPrompt = prompt;
      await saveObjectInLocalStorage({ [STORAGE_KEYS.AI_REVIEW_PROMPT]: prompt });
      showMessage("success", "프롬프트가 저장되었습니다.");
    });
  }

  // Reset AI prompt to default
  if (elements.resetPrompt) {
    elements.resetPrompt.addEventListener("click", async () => {
      if (elements.aiPrompt) {
        elements.aiPrompt.value = DEFAULT_PROMPT_TEMPLATE;
      }
      appSettings.aiPrompt = DEFAULT_PROMPT_TEMPLATE;
      await saveObjectInLocalStorage({ [STORAGE_KEYS.AI_REVIEW_PROMPT]: DEFAULT_PROMPT_TEMPLATE });
      showMessage("success", "프롬프트가 기본값으로 초기화되었습니다.");
    });
  }

  // AI prompt variable buttons
  if (elements.aiPromptVariables) {
    const variableBtns = elements.aiPromptVariables.querySelectorAll<HTMLElement>(".variable-btn");
    variableBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const variable = btn.dataset.variable;
        if (variable && elements.aiPrompt) {
          const cursorPos = elements.aiPrompt.selectionStart || 0;
          const currentValue = elements.aiPrompt.value;
          const newValue = currentValue.slice(0, cursorPos) + variable + currentValue.slice(cursorPos);
          elements.aiPrompt.value = newValue;
          const newCursorPos = cursorPos + variable.length;
          elements.aiPrompt.setSelectionRange(newCursorPos, newCursorPos);
          elements.aiPrompt.focus();
        }
      });
    });
  }
}

/**
 * Tooltip manager class for managing tooltips
 */
class TooltipManager {
  private tooltip: HTMLDivElement;

  constructor() {
    this.tooltip = document.createElement("div");
    this.init();
  }

  private init(): void {
    this.tooltip.className = "tooltip";
    document.body.appendChild(this.tooltip);
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const elementsWithTooltip = document.querySelectorAll<HTMLElement>("[data-tooltip]");

    elementsWithTooltip.forEach((element) => {
      element.addEventListener("mouseenter", (e) => {
        this.showTooltip(e.target as HTMLElement);
      });

      element.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });

      element.addEventListener("mousemove", (e) => {
        this.updateTooltipPosition(e as MouseEvent);
      });
    });
  }

  private showTooltip(element: HTMLElement): void {
    const tooltipText = element.getAttribute("data-tooltip");
    if (!tooltipText) return;

    this.tooltip.textContent = tooltipText;
    this.tooltip.classList.add("show");
  }

  private hideTooltip(): void {
    this.tooltip.classList.remove("show");
  }

  private updateTooltipPosition(event: MouseEvent): void {
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let left = event.pageX - tooltipRect.width / 2;
    let top = event.pageY - tooltipRect.height - 10;

    // Left boundary
    if (left < 0) {
      left = 5;
    }
    // Right boundary
    if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - 5;
    }
    // Top boundary (show below)
    if (top < 0) {
      top = event.pageY + 10;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  /**
   * Refresh event listeners for dynamically added elements
   */
  public refresh(): void {
    this.attachEventListeners();
  }
}

/**
 * Template builder class for managing template customization
 */
class TemplateBuilder {
  private templateInput: HTMLInputElement | null;
  private templatePreview: HTMLElement | null;
  private presetCards: NodeListOf<HTMLElement>;
  private variableBtns: NodeListOf<HTMLElement>;
  private filterBtns: NodeListOf<HTMLElement>;
  private saveBtn: HTMLElement | null;
  private resetBtn: HTMLElement | null;

  constructor() {
    this.templateInput = document.getElementById("templateString") as HTMLInputElement | null;
    this.templatePreview = document.getElementById("templatePreview");
    this.presetCards = document.querySelectorAll<HTMLElement>(".preset-card");
    this.variableBtns = document.querySelectorAll<HTMLElement>(".variable-btn");
    this.filterBtns = document.querySelectorAll<HTMLElement>(".filter-btn");
    this.saveBtn = document.getElementById("saveTemplate");
    this.resetBtn = document.getElementById("resetTemplate");

    this.init();
  }

  private init(): void {
    // Preset card click events
    this.presetCards.forEach((card) => {
      card.addEventListener("click", () => {
        this.selectPreset(card);
      });
    });

    // Variable button click events
    this.variableBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const variable = btn.dataset.variable;
        if (variable) {
          this.insertVariable(variable);
        }
      });
    });

    // Filter button click events
    this.filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const functionName = btn.dataset.function;
        if (functionName) {
          this.insertFunction(functionName);
        }
      });
    });

    // Template input real-time update
    if (this.templateInput) {
      this.templateInput.addEventListener("input", () => {
        this.updatePreview();
      });
    }

    // Save button event
    if (this.saveBtn) {
      this.saveBtn.addEventListener("click", () => {
        this.saveTemplate();
      });
    }

    // Reset button event
    if (this.resetBtn) {
      this.resetBtn.addEventListener("click", () => {
        this.resetTemplate();
      });
    }

    // Initial preview update
    this.updatePreview();
  }

  private selectPreset(selectedCard: HTMLElement): void {
    // Deselect all
    this.presetCards.forEach((card) => card.classList.remove("selected"));

    // Select new
    selectedCard.classList.add("selected");

    // Apply template
    const template = selectedCard.dataset.template;
    if (this.templateInput && template) {
      this.templateInput.value = template;
      this.updatePreview();
    }
  }

  private insertVariable(variable: string): void {
    if (!this.templateInput) return;

    const cursorPos = this.templateInput.selectionStart || 0;
    const currentValue = this.templateInput.value;
    const newValue = currentValue.slice(0, cursorPos) + variable + currentValue.slice(cursorPos);

    this.templateInput.value = newValue;

    // Adjust cursor position
    const newCursorPos = cursorPos + variable.length;
    this.templateInput.setSelectionRange(newCursorPos, newCursorPos);
    this.templateInput.focus();

    this.updatePreview();
  }

  private insertFunction(functionName: string): void {
    if (!this.templateInput) return;

    const cursorPos = this.templateInput.selectionStart || 0;
    const currentValue = this.templateInput.value;
    const newValue = currentValue.slice(0, cursorPos) + functionName + "()" + currentValue.slice(cursorPos);

    this.templateInput.value = newValue;

    // Move cursor inside parentheses
    const newCursorPos = cursorPos + functionName.length + 1;
    this.templateInput.setSelectionRange(newCursorPos, newCursorPos);
    this.templateInput.focus();

    this.updatePreview();
  }

  private updatePreview(): void {
    if (!this.templateInput || !this.templatePreview) return;

    const template =
      this.templateInput.value || "{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}";

    try {
      // Sample data
      const sampleData = {
        platform: "백준",
        problemId: "1000",
        title: "A+B",
        level: "Silver V",
        language: "Python",
      };

      // Parse with safe-template-parser
      const result = parseTemplateString(template, sampleData, getTextTransforms() as unknown as SafeTextTransforms);

      // Add file extension if missing
      const finalResult = result.includes(".") ? result : result + ".py";

      this.templatePreview.textContent = finalResult;
      this.templatePreview.style.color = "#fbb6ce";
    } catch (error) {
      log.error("Template parsing error:", error);
      this.templatePreview.textContent = `템플릿 구문 오류: ${(error as Error).message}`;
      this.templatePreview.style.color = "#f56565";
    }
  }

  private async saveTemplate(): Promise<void> {
    try {
      if (!this.templateInput) return;

      const templateString = this.templateInput.value;
      appSettings.templateString = templateString;

      await saveObjectInLocalStorage({
        [STORAGE_KEYS.DIR_TEMPLATE]: templateString,
      });

      showMessage("success", "템플릿이 저장되었습니다.");
    } catch (error) {
      log.error("Template save error:", error);
      showMessage("error", "템플릿 저장에 실패했습니다.");
    }
  }

  private resetTemplate(): void {
    const defaultTemplate = "{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}";

    if (this.templateInput) {
      this.templateInput.value = defaultTemplate;
      this.updatePreview();
    }

    // Deselect presets
    this.presetCards.forEach((card) => card.classList.remove("selected"));

    showMessage("success", "템플릿이 초기화되었습니다.");
  }
}

/**
 * Initialize settings app
 */
async function init(): Promise<void> {
  log.info("BaekjoonHub Settings initialized");

  try {
    initElements();
    await detectAndSetMode();
    setupEventListeners();
    validateForm();

    // Initialize tooltip manager
    new TooltipManager();

    // Initialize template builder
    new TemplateBuilder();
  } catch (error) {
    log.error("Initialization error:", error);
  }
}

// DOM load handler
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
