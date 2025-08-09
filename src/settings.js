import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "./scripts/commons/storage.js";
import { STORAGE_KEYS } from "./scripts/constants/registry.js";
import beginOAuth2 from "./scripts/commons/oauth2.js";
import { parseTemplateString } from "safe-template-parser";
import { getTextTransforms } from "./scripts/commons/text-transforms.js";
import log from "./scripts/commons/logger.js";

// 설정 상태 관리
let appSettings = {
  connected: false,
  repoName: "",
  autoUpload: true,
  useCustomTemplate: false,
  templateString: "{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}",
};

// GitHub 사용자 정보 및 저장소 목록
let githubUserInfo = {
  username: "",
  repositories: [],
};

// DOM 요소들
const elements = {
  connectionStatus: document.getElementById("connectionStatus"),
  errorMessage: document.getElementById("errorMessage"),
  successMessage: document.getElementById("successMessage"),
  setupSection: document.getElementById("setupSection"),
  settingsSection: document.getElementById("settingsSection"),
  managementSection: document.getElementById("managementSection"),
  repoType: document.getElementById("repoType"),
  repoName: document.getElementById("repoName"),
  repoSelect: document.getElementById("repoSelect"),
  connectRepo: document.getElementById("connectRepo"),
  autoUpload: document.getElementById("autoUpload"),
  useCustomTemplate: document.getElementById("useCustomTemplate"),
  customTemplateInput: document.getElementById("customTemplateInput"),
  templateString: document.getElementById("templateString"),
  templatePreview: document.getElementById("templatePreview"),
  unlinkRepo: document.getElementById("unlinkRepo"),
  saveTemplate: document.getElementById("saveTemplate"),
  resetTemplate: document.getElementById("resetTemplate"),
};

// GitHub 저장소 URL로 이동
function openRepositoryURL(repoName) {
  if (repoName && repoName.includes('/')) {
    const githubURL = `https://github.com/${repoName}`;
    window.open(githubURL, '_blank');
    log.debug('Opening repository URL:', githubURL);
  } else {
    log.error('Invalid repository name:', repoName);
  }
}

// 유틸리티 함수들
function showMessage(type, text, autoHide = true) {
  const messageEl = elements[type + "Message"];
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.style.display = "block";

  if (autoHide) {
    setTimeout(() => {
      messageEl.style.display = "none";
    }, 5000);
  }
}

function hideMessage(type) {
  const messageEl = elements[type + "Message"];
  if (messageEl) {
    messageEl.style.display = "none";
  }
}

// 연결 상태 업데이트
function updateConnectionStatus() {
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
    elements.setupSection.style.display = "none";
    elements.settingsSection.style.display = "block";
    elements.managementSection.style.display = "block";
  } else {
    elements.connectionStatus.innerHTML = `
      <div class="status-disconnected">
        GitHub 저장소가 연결되지 않았습니다. 아래에서 저장소를 설정해주세요.
      </div>
    `;
    elements.setupSection.style.display = "block";
    elements.settingsSection.style.display = "none";
    elements.managementSection.style.display = "none";
  }
}

// 모드 감지 및 설정
async function detectAndSetMode() {
  try {
    const data = await getObjectFromLocalStorage([STORAGE_KEYS.MODE_TYPE, STORAGE_KEYS.HOOK, STORAGE_KEYS.TOKEN, STORAGE_KEYS.ENABLE, STORAGE_KEYS.USE_CUSTOM_TEMPLATE, STORAGE_KEYS.DIR_TEMPLATE]);

    const modeType = data[STORAGE_KEYS.MODE_TYPE];
    const hook = data[STORAGE_KEYS.HOOK];
    const token = data[STORAGE_KEYS.TOKEN];
    const enabled = data[STORAGE_KEYS.ENABLE];
    const useCustomTemplate = data[STORAGE_KEYS.USE_CUSTOM_TEMPLATE];
    const dirTemplate = data[STORAGE_KEYS.DIR_TEMPLATE];

    if (modeType === "commit" && hook) {
      if (!token) {
        // 토큰이 없으면 OAuth 필요
        showAuthorizationError();
        return;
      }

      // 연결된 상태
      appSettings.connected = true;
      appSettings.repoName = hook;
      appSettings.autoUpload = enabled !== false;
      appSettings.useCustomTemplate = useCustomTemplate || false;
      appSettings.templateString = dirTemplate || "{{language}}/{{level}}/{{problemId}}. {{title}}";

      updateConnectionStatus();
      updateFormValues();
    } else {
      // 연결되지 않은 상태
      appSettings.connected = false;
      updateConnectionStatus();
    }
  } catch (error) {
    log.error("Mode detection error:", error);
    appSettings.connected = false;
    updateConnectionStatus();
  }
}

// 토큰 유효성 확인 함수
async function checkGitHubToken() {
  try {
    const token = await getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);

    // 토큰이 없거나 빈 문자열인 경우
    if (!token || token.trim() === "") {
      return null;
    }

    return token;
  } catch (error) {
    log.error("Token check error:", error);
    return null;
  }
}

// GitHub 인증 안내 표시
function showGitHubAuthRequired() {
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

  // 인증 버튼 이벤트 리스너 추가
  const authorizeButton = document.getElementById("authorize_button");
  if (authorizeButton) {
    authorizeButton.addEventListener("click", () => {
      hideMessage("error");
      beginOAuth2();
    });
  }
}

// 인증 오류 표시
function showAuthorizationError() {
  elements.errorMessage.innerHTML = 'GitHub 계정 인증이 필요합니다. <button id="authorize_button" class="button button-primary">인증하기</button>';
  elements.errorMessage.style.display = "block";

  const authorizeButton = document.getElementById("authorize_button");
  if (authorizeButton) {
    authorizeButton.addEventListener("click", beginOAuth2);
  }
}

// 폼 값 업데이트
function updateFormValues() {
  if (elements.autoUpload) {
    elements.autoUpload.checked = appSettings.autoUpload;
  }
  if (elements.useCustomTemplate) {
    elements.useCustomTemplate.checked = appSettings.useCustomTemplate;
    elements.customTemplateInput.style.display = appSettings.useCustomTemplate ? "block" : "none";
  }
  if (elements.templateString) {
    elements.templateString.value = appSettings.templateString;
  }
}

// GitHub 사용자 정보 및 저장소 목록 가져오기
async function fetchGitHubUserInfo() {
  try {
    const data = await getObjectFromLocalStorage([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USERNAME]);
    const token = data[STORAGE_KEYS.TOKEN];
    const username = data[STORAGE_KEYS.USERNAME];

    if (!token || !username) {
      return null;
    }

    githubUserInfo.username = username;

    // GitHub API를 통해 사용자의 저장소 목록 가져오기
    const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (response.ok) {
      const repos = await response.json();
      githubUserInfo.repositories = repos.map((repo) => ({
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

// 저장소 선택 드롭다운 업데이트
function updateRepositorySelect() {
  if (!elements.repoSelect) return;

  // 기존 옵션 제거 (기본 옵션 제외)
  while (elements.repoSelect.options.length > 1) {
    elements.repoSelect.removeChild(elements.repoSelect.lastChild);
  }

  // 새로운 옵션 추가
  githubUserInfo.repositories.forEach((repo) => {
    const option = document.createElement("option");
    option.value = repo.fullName;
    option.textContent = `${repo.name} ${repo.private ? "(비공개)" : ""}`;
    if (repo.description) {
      option.textContent += ` - ${repo.description}`;
    }
    elements.repoSelect.appendChild(option);
  });
}

// 저장소 타입 변경 처리
async function handleRepoTypeChange() {
  const repoType = elements.repoType.value;

  if (repoType === "new") {
    // 새 저장소 생성: input 보이고, select 숨김
    elements.repoName.style.display = "block";
    elements.repoSelect.style.display = "none";

    // GitHub 사용자명 가져오기
    const userInfo = await fetchGitHubUserInfo();
    if (userInfo && userInfo.username) {
      elements.repoName.value = `${userInfo.username}/TIL`;
    } else {
      elements.repoName.value = "username/TIL";
    }
  } else if (repoType === "existing") {
    // 기존 저장소 연결: 먼저 토큰 확인
    const token = await checkGitHubToken();
    if (!token) {
      showGitHubAuthRequired();
      // 선택 초기화
      elements.repoType.value = "";
      return;
    }

    // input 숨김, select 보이고
    elements.repoName.style.display = "none";
    elements.repoSelect.style.display = "block";

    // 저장소 목록 가져오기 및 업데이트
    const userInfo = await fetchGitHubUserInfo();
    if (userInfo) {
      updateRepositorySelect();
    } else {
      showMessage("error", "GitHub 사용자 정보를 가져올 수 없습니다. 다시 로그인해 주세요.");
    }
  } else {
    // 옵션 선택 안함: 둘 다 숨김
    elements.repoName.style.display = "none";
    elements.repoSelect.style.display = "none";
    elements.repoName.value = "";
    elements.repoSelect.value = "";
  }

  validateForm();
}

// 저장소 선택 처리
function handleRepoSelect() {
  const selectedRepo = elements.repoSelect.value;
  if (selectedRepo) {
    elements.repoName.value = selectedRepo;
  }
  validateForm();
}

// 폼 유효성 검사
function validateForm() {
  const repoType = elements.repoType.value;
  let repoName = "";

  if (repoType === "new") {
    repoName = elements.repoName.value;
  } else if (repoType === "existing") {
    repoName = elements.repoSelect.value || elements.repoName.value;
  }

  const isValid = repoType && repoName && repoName.includes("/");
  elements.connectRepo.disabled = !isValid;

  return isValid;
}

// 저장소 연결 처리
async function handleRepoConnection() {
  // 먼저 토큰 확인
  const token = await checkGitHubToken();
  if (!token) {
    showGitHubAuthRequired();
    return;
  }

  if (!validateForm()) {
    showMessage("error", "모든 필드를 올바르게 입력해주세요.");
    return;
  }

  const repoType = elements.repoType.value;
  let repoName = "";

  if (repoType === "new") {
    repoName = elements.repoName.value;
  } else if (repoType === "existing") {
    repoName = elements.repoSelect.value || elements.repoName.value;
  }

  try {
    hideMessage("error");
    elements.connectRepo.disabled = true;
    elements.connectRepo.textContent = "연결 중...";

    // 저장소 설정 저장
    await saveObjectInLocalStorage({
      [STORAGE_KEYS.MODE_TYPE]: "commit",
      [STORAGE_KEYS.HOOK]: repoName,
    });

    // OAuth 시작
    await beginOAuth2();
  } catch (error) {
    log.error("Repository connection error:", error);
    showMessage("error", "저장소 연결에 실패했습니다. 다시 시도해주세요.");
    elements.connectRepo.disabled = false;
    elements.connectRepo.textContent = "연결하기";
  }
}

// 저장소 연결 해제
async function handleRepoDisconnection() {
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

// 설정 저장
async function saveSettings() {
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

// 이벤트 리스너 등록
function setupEventListeners() {
  // 저장소 타입 변경
  if (elements.repoType) {
    elements.repoType.addEventListener("change", handleRepoTypeChange);
  }

  // 저장소 선택
  if (elements.repoSelect) {
    elements.repoSelect.addEventListener("change", handleRepoSelect);
  }

  // 폼 유효성 검사
  if (elements.repoName) {
    elements.repoName.addEventListener("input", validateForm);
  }

  // 저장소 연결/해제
  if (elements.connectRepo) {
    elements.connectRepo.addEventListener("click", handleRepoConnection);
  }
  if (elements.unlinkRepo) {
    elements.unlinkRepo.addEventListener("click", handleRepoDisconnection);
  }

  // 설정 변경
  if (elements.autoUpload) {
    elements.autoUpload.addEventListener("change", async (e) => {
      appSettings.autoUpload = e.target.checked;
      await saveSettings();
    });
  }

  if (elements.useCustomTemplate) {
    elements.useCustomTemplate.addEventListener("change", async (e) => {
      appSettings.useCustomTemplate = e.target.checked;
      elements.customTemplateInput.style.display = e.target.checked ? "block" : "none";
      await saveSettings();
    });
  }

  if (elements.templateString) {
    elements.templateString.addEventListener("input", async (e) => {
      appSettings.templateString = e.target.value;
      // 실시간 업데이트는 TemplateBuilder에서 처리
    });
  }
}

// 툴팁 관리 클래스
class TooltipManager {
  constructor() {
    this.tooltip = null;
    this.init();
  }

  init() {
    // 툴팁 요소 생성
    this.tooltip = document.createElement("div");
    this.tooltip.className = "tooltip";
    document.body.appendChild(this.tooltip);

    // 툴팁이 있는 모든 요소에 이벤트 리스너 추가
    this.attachEventListeners();
  }

  attachEventListeners() {
    const elementsWithTooltip = document.querySelectorAll("[data-tooltip]");

    elementsWithTooltip.forEach((element) => {
      element.addEventListener("mouseenter", (e) => {
        this.showTooltip(e.target);
      });

      element.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });

      element.addEventListener("mousemove", (e) => {
        this.updateTooltipPosition(e);
      });
    });
  }

  showTooltip(element) {
    const tooltipText = element.getAttribute("data-tooltip");
    if (!tooltipText) return;

    this.tooltip.textContent = tooltipText;
    this.tooltip.classList.add("show");
  }

  hideTooltip() {
    this.tooltip.classList.remove("show");
  }

  updateTooltipPosition(event) {
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = event.pageX - tooltipRect.width / 2;
    let top = event.pageY - tooltipRect.height - 10;

    // 왼쪽 경계 처리
    if (left < 0) {
      left = 5;
    }
    // 오른쪽 경계 처리
    if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - 5;
    }
    // 위쪽 경계 처리 (아래쪽에 표시)
    if (top < 0) {
      top = event.pageY + 10;
    }

    this.tooltip.style.left = left + "px";
    this.tooltip.style.top = top + "px";
  }

  // 동적으로 추가된 요소들에 대해 이벤트 리스너 재등록
  refresh() {
    this.attachEventListeners();
  }
}

// 템플릿 빌더 클래스
class TemplateBuilder {
  constructor() {
    this.templateInput = document.getElementById("templateString");
    this.templatePreview = document.getElementById("templatePreview");
    this.presetCards = document.querySelectorAll(".preset-card");
    this.variableBtns = document.querySelectorAll(".variable-btn");
    this.filterBtns = document.querySelectorAll(".filter-btn");
    this.saveBtn = document.getElementById("saveTemplate");
    this.resetBtn = document.getElementById("resetTemplate");

    this.init();
  }

  init() {
    // 프리셋 카드 클릭 이벤트
    this.presetCards.forEach((card) => {
      card.addEventListener("click", () => {
        this.selectPreset(card);
      });
    });

    // 변수 버튼 클릭 이벤트
    this.variableBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.insertVariable(btn.dataset.variable);
      });
    });

    // 필터 버튼 클릭 이벤트
    this.filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.insertFunction(btn.dataset.function);
      });
    });

    // 템플릿 입력 실시간 업데이트
    if (this.templateInput) {
      this.templateInput.addEventListener("input", () => {
        this.updatePreview();
      });
    }

    // 저장 버튼 이벤트
    if (this.saveBtn) {
      this.saveBtn.addEventListener("click", () => {
        this.saveTemplate();
      });
    }

    // 초기화 버튼 이벤트
    if (this.resetBtn) {
      this.resetBtn.addEventListener("click", () => {
        this.resetTemplate();
      });
    }

    // 초기 미리보기 업데이트
    this.updatePreview();
  }

  selectPreset(selectedCard) {
    // 기존 선택 해제
    this.presetCards.forEach((card) => card.classList.remove("selected"));

    // 새로운 선택
    selectedCard.classList.add("selected");

    // 템플릿 적용
    const template = selectedCard.dataset.template;
    if (this.templateInput) {
      this.templateInput.value = template;
      this.updatePreview();
    }
  }

  insertVariable(variable) {
    if (!this.templateInput) return;

    const cursorPos = this.templateInput.selectionStart;
    const currentValue = this.templateInput.value;
    const newValue = currentValue.slice(0, cursorPos) + variable + currentValue.slice(cursorPos);

    this.templateInput.value = newValue;

    // 커서 위치 조정
    const newCursorPos = cursorPos + variable.length;
    this.templateInput.setSelectionRange(newCursorPos, newCursorPos);
    this.templateInput.focus();

    this.updatePreview();
  }

  insertFunction(functionName) {
    if (!this.templateInput) return;

    const cursorPos = this.templateInput.selectionStart;
    const currentValue = this.templateInput.value;
    const newValue = currentValue.slice(0, cursorPos) + functionName + "()" + currentValue.slice(cursorPos);

    this.templateInput.value = newValue;

    // 함수 괄호 안으로 커서 이동
    const newCursorPos = cursorPos + functionName.length + 1;
    this.templateInput.setSelectionRange(newCursorPos, newCursorPos);
    this.templateInput.focus();

    this.updatePreview();
  }

  updatePreview() {
    if (!this.templateInput || !this.templatePreview) return;

    const template = this.templateInput.value || "{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}";

    try {
      // 예시 데이터
      const sampleData = {
        platform: "백준",
        problemId: "1000",
        title: "A+B",
        level: "Silver V",
        language: "Python",
      };

      // safe-template-parser 사용하여 파싱
      const result = parseTemplateString(template, sampleData, getTextTransforms());

      // 파일 확장자 추가 (없는 경우)
      const finalResult = result.includes(".") ? result : result + ".py";

      this.templatePreview.textContent = finalResult;
      this.templatePreview.style.color = "#fbb6ce";
    } catch (error) {
      log.error("Template parsing error:", error);
      this.templatePreview.textContent = "템플릿 구문 오류: " + error.message;
      this.templatePreview.style.color = "#f56565";
    }
  }

  async saveTemplate() {
    try {
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

  resetTemplate() {
    const defaultTemplate = "{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}";

    if (this.templateInput) {
      this.templateInput.value = defaultTemplate;
      this.updatePreview();
    }

    // 프리셋 선택 해제
    this.presetCards.forEach((card) => card.classList.remove("selected"));

    showMessage("success", "템플릿이 초기화되었습니다.");
  }
}

// 앱 초기화
async function init() {
  log.info("BaekjoonHub Settings initialized");

  try {
    await detectAndSetMode();
    setupEventListeners();
    validateForm();

    // 툴팁 매니저 초기화
    new TooltipManager();

    // 템플릿 빌더 초기화
    new TemplateBuilder();
  } catch (error) {
    log.error("Initialization error:", error);
  }
}

// DOM이 로드되면 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
