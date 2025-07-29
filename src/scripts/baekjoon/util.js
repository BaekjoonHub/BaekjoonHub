import { markUploadedCSS as markUploaded, markUploadFailedCSS as markFailed } from "@/commons/ui-util.js";
import { parseNumberFromString, maxValuesGroupBykey, isNull, filter, isEmpty } from "@/commons/util.js";
import { uploadState, RESULT_CATEGORY } from "@/baekjoon/variables.js";
import { parsingResultTableList } from "@/baekjoon/parsing.js";
import { Toast } from "@/commons/toast.js";
import log from "@/commons/logger.js";

/**
 * 제출 모니터링 시작 알림
 */
export function startMonitoringToast() {
  Toast.info("🔍 백준 제출 결과 모니터링 중...", 3000);
  log.debug("startMonitoringToast: Monitoring toast displayed");
}

/**
 * 업로드 시작 알림
 */
export function startUpload() {
  Toast.info("🚀 GitHub 업로드를 시작합니다!", 3000);
  log.debug("startUpload: Upload start toast displayed");
}

/**
 * 업로드 완료 알림
 * @param {object} branches - 브랜치 정보
 * @param {string} directory - 디렉토리 정보
 */
export function markUploadedCSS(branches, directory) {
  if (uploadState) {
    uploadState.uploading = false;
  }
  
  // GitHub 링크 생성
  const repoName = Object.keys(branches)[0];
  const branchName = branches[repoName];
  const uploadedUrl = `https://github.com/${repoName}/tree/${branchName}/${directory}`;
  
  // 성공 Toast에 클릭 가능한 링크 표시
  const directoryParts = directory.split('/');
  const problemInfo = directoryParts[directoryParts.length - 1] || directory;
  const successMessage = `✨ 업로드 성공! ${problemInfo}`;
  const toast = Toast.success(successMessage, 8000);
  
  // Toast 클릭 시 GitHub 페이지로 이동
  if (toast && toast.element) {
    toast.element.style.cursor = "pointer";
    
    // 클릭 가능한 시각적 히트 추가
    const linkIcon = document.createElement("div");
    linkIcon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-left: 8px; opacity: 0.8;">
        <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
        <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
      </svg>
    `;
    linkIcon.style.display = "inline-block";
    linkIcon.style.verticalAlign = "middle";
    
    const messageContainer = toast.element.querySelector(".message-container");
    const textSpan = messageContainer.querySelector("span");
    if (textSpan) {
      textSpan.appendChild(linkIcon);
    }
    
    // 안내 텍스트 추가
    const infoText = document.createElement("div");
    infoText.style.cssText = `
      font-size: 13px;
      opacity: 0.8;
      margin-top: 6px;
      font-weight: 400;
    `;
    infoText.textContent = "클릭하여 GitHub에서 확인 →";
    messageContainer.appendChild(infoText);
    
    toast.element.addEventListener("click", () => {
      window.open(uploadedUrl, "_blank");
    });
  }
  
  log.debug("markUploadedCSS: Upload success toast displayed");
}

/**
 * 업로드 실패 알림
 */
export function markUploadFailedCSS() {
  if (uploadState) {
    uploadState.uploading = false;
  }
  
  Toast.danger("🚫 업로드 실패! 다시 시도해주세요.", 5000);
  log.debug("markUploadFailedCSS: Upload failure toast displayed");
}

/**
 * 현재 로그인된 사용자명을 찾는 함수
 * @returns {string|null} - 사용자명 또는 null
 */
export function findUsername() {
  try {
    // 백준 사이트에서 사용자명을 찾는 다양한 방법들
    let username = null;

    // 방법 1: 상단 네비게이션에서 사용자명 찾기
    const usernameElement = document.querySelector(".username");
    if (usernameElement) {
      username = usernameElement.textContent.trim();
    }

    // 방법 2: 프로필 링크에서 사용자명 찾기
    if (!username) {
      const profileLink = document.querySelector('a[href*="/user/"]');
      if (profileLink) {
        const href = profileLink.getAttribute("href");
        const match = href.match(/\/user\/([^/]+)/);
        if (match) {
          username = match[1];
        }
      }
    }

    // 방법 3: 페이지 URL에서 user_id 파라미터 찾기
    if (!username) {
      const urlParams = new URLSearchParams(window.location.search);
      username = urlParams.get("user_id");
    }

    log.debug("findUsername - found username:", username);
    return username;
  } catch (error) {
    log.error("findUsername - Error:", error);
    return null;
  }
}

/**
 * 결과 테이블이 존재하는지 확인하는 함수
 * @returns {boolean}
 */
export function isExistResultTable() {
  const table = document.getElementById("status-table");
  const hasTable = table !== null && table !== undefined;
  log.debug("isExistResultTable - table exists:", hasTable);
  return hasTable;
}

/**
 * 결과 테이블에서 데이터를 가져오는 함수 (구 버전 호환성)
 * @returns {Array<Object>}
 */
export function findFromResultTable() {
  if (!isExistResultTable()) {
    log.debug("findFromResultTable - Result table not found");
    return [];
  }

  try {
    const resultList = parsingResultTableList(document);
    log.debug("findFromResultTable - parsed results:", resultList);
    return resultList;
  } catch (error) {
    log.error("findFromResultTable - Error:", error);
    return [];
  }
}

/**
 * 제출 목록 비교함수입니다
 * @param {object} a - 제출 요소 피연산자 a
 * @param {object} b - 제출 요소 피연산자 b
 * @returns {number} - a와 b 아래의 우선순위로 값을 비교하여 정수값을 반환합니다.
 * 1. 서브태스크가 있는 문제이고, 점수(result)의 차이가 있을 경우 a > b 이면 음수, a < b 이면 양수를 반환합니다.
 * 2. 실행시간(runtime)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 3. 사용메모리(memory)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 4. 코드길이(codeLength)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 5. 위의 요소가 모두 같은 경우 제출한 요소(submissionId)의 그 차이 값의 역을 반환합니다.
 * */
export function compareSubmission(a, b) {
  // prettier-ignore-start
  /* eslint-disable */
  return hasNotSubtask(a.result, b.result)
    ? a.runtime === b.runtime
      ? a.memory === b.memory
        ? a.codeLength === b.codeLength
          ? -(a.submissionId - b.submissionId)
          : a.codeLength - b.codeLength
        : a.memory - b.memory
      : a.runtime - b.runtime
    : compareResult(a.result, b.result);
  /* eslint-enable */
  // prettier-ignore-end
}

/**
 * 서브태스크가 있는 문제의 경우도 고려해 제출 결과를 비교하는 함수입니다.
 * 점수가 표기 되어있지 않으면, 서브태스크가 없는 문제입니다.
 * 따라서 서브태스크가 없는 경우와 있는 경우를 분기하여 처리합니다.
 * @param {string} a - 비교할 대상 a
 * @param {string} b - 비교할 대상 b
 * @returns {boolean} - 서브태스크가 없으면 true, 있으면 false
 */
export function hasNotSubtask(a, b) {
  const aIsNaN = Number.isNaN(parseNumberFromString(a));
  const bIsNaN = Number.isNaN(parseNumberFromString(b));
  return aIsNaN && bIsNaN;
}

/**
 * 서브태스크가 있는 문제의 result 를 비교하는 함수입니다.
 * parseNumberFromString 함수를 이용해 숫자를 추출하고, 그 숫자를 이용해 비교합니다.
 * @param {string} a - 비교할 대상 a
 * @param {string} b - 비교할 대상 b
 * @returns {number} - a - b 의 결과
 */
export function compareResult(a, b) {
  return parseNumberFromString(b) - parseNumberFromString(a);
}

/**
 * 제출한 코드 중 가장 좋은 성능을 가진 제출만을 선택하는 함수입니다.
 * 동일한 problemId, language 조합에서 가장 좋은 성능의 제출을 반환합니다.
 * @param {Array<Object>} submissions - 제출 목록
 * @returns {Array<Object>} - 중복이 제거된 최고 성능 제출 목록
 */
export function selectBestSubmissionList(submissions) {
  if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
    return [];
  }

  try {
    // problemId와 language를 기준으로 그룹화
    const grouped = maxValuesGroupBykey(submissions, ["problemId", "language"], compareSubmission);
    log.debug("selectBestSubmissionList - grouped submissions:", grouped);
    return grouped;
  } catch (error) {
    log.error("selectBestSubmissionList - Error:", error);
    return submissions; // 오류 발생시 원본 반환
  }
}

/**
 * 결과 테이블의 헤더를 변환하는 함수
 * @param {string} header - 테이블 헤더 문자열
 * @returns {string} - 변환된 헤더 문자열
 */
export function convertResultTableHeader(header) {
  switch (header) {
    case "문제번호":
    case "문제":
      return "problemId";
    case "난이도":
      return "level";
    case "결과":
      return "result";
    case "문제내용":
      return "problemDescription";
    case "언어":
      return "language";
    case "제출 번호":
      return "submissionId";
    case "아이디":
      return "username";
    case "제출시간":
    case "제출한 시간":
      return "submissionTime";
    case "시간":
      return "runtime";
    case "메모리":
      return "memory";
    case "코드 길이":
      return "codeLength";
    default:
      return "unknown";
  }
}

/**
 * 백준에서 표기된 프로그래밍 언어의 버전을 없애고 업로드 하기 위함입니다.
 * 버전에 차이가 중요하게 여겨진다면, 'ignore'에 예외 케이스를 추가하세요.
 * 해당 코드는 'lang'이 "PyPy3" 같이 주어진다면은 버전을 제거하지 않습니다.
 * 예외에 추가 되어있거나, "Python 3.8" 혹은 "Java 11" 같이 주어진다면 버전이 제거될것입니다.
 * @param {string} lang - 처리 하고자 하는 언어입니다.
 * @param {Set} ignores - 예외 처리 하고자 하는 언어를 추가 해주세요.
 * @return {string} - 분기 처리에 따른 lang
 */
export function langVersionRemove(lang, ignores) {
  if (!lang) return "";

  const ignoredLanguages = ignores || new Set(["PyPy3", "PyPy2", "node.js"]);

  if (ignoredLanguages.has(lang)) {
    return lang;
  }

  // 버전 숫자와 점을 제거 (예: "Python 3.8" -> "Python", "Java 11" -> "Java")
  return lang.replace(/\s+[\d.]+.*$/, "").trim();
}
