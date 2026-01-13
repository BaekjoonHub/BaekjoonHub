/**
 * Baekjoon platform utility functions
 * Handles UI notifications, username detection, and submission validation
 */
import { parseNumberFromString, maxValuesGroupBykey, isNull } from "@/commons/util";
import { uploadState, RESULT_CATEGORY } from "@/baekjoon/variables";
import { parsingResultTableList } from "@/baekjoon/parsing";
import { createUploadNotifications } from "@/commons/upload-notifications";
import { Toast } from "@/commons/toast";
import log from "@/commons/logger";

// Create notification service for Baekjoon
const notifications = createUploadNotifications("백준", uploadState);

// Submission data interface
interface SubmissionData {
  problemId?: string;
  submissionId?: string;
  username?: string;
  result?: string;
  resultCategory?: string;
  language?: string;
  runtime?: string;
  memory?: string;
  codeLength?: string;
  submissionTime?: string;
  elementId?: string;
  [key: string]: string | undefined;
}

/**
 * Show monitoring start notification
 */
export function startMonitoringToast(): void {
  Toast.info("백준 제출 결과 모니터링 중...", 3000);
  log.debug("startMonitoringToast: Monitoring toast displayed");
}

/**
 * Show upload start notification
 */
export function startUpload(): void {
  notifications.startUpload();
  log.debug("startUpload: Upload start toast displayed");
}

/**
 * Show upload success notification with GitHub link
 * @param branches - Branch info (repoName: branchName)
 * @param directory - Directory path
 */
export function markUploadedCSS(branches: Record<string, string>, directory: string): void {
  if (!directory) {
    log.warn("markUploadedCSS called with undefined directory");
    return;
  }

  notifications.markUploadSuccess(branches, directory);
  log.debug("markUploadedCSS: Upload success toast displayed");
}

/**
 * Show upload failure notification
 */
export function markUploadFailedCSS(): void {
  notifications.markUploadFailed();
  log.debug("markUploadFailedCSS: Upload failure toast displayed");
}

/**
 * Find logged-in username from the page
 * @returns Username or null
 */
export function findUsername(): string | null {
  try {
    let username: string | null = null;

    // Method 1: Find username from top navigation
    const usernameElement = document.querySelector(".username");
    if (usernameElement) {
      username = usernameElement.textContent?.trim() || null;
    }

    // Method 2: Find username from profile link
    if (!username) {
      const profileLink = document.querySelector('a[href*="/user/"]');
      if (profileLink) {
        const href = profileLink.getAttribute("href");
        const match = href?.match(/\/user\/([^/]+)/);
        if (match) {
          username = match[1];
        }
      }
    }

    // Method 3: Find user_id from URL params
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
 * Check if result table exists on the page
 * @returns Whether result table exists
 */
export function isExistResultTable(): boolean {
  const table = document.getElementById("status-table");
  const hasTable = table !== null && table !== undefined;
  log.debug("isExistResultTable - table exists:", hasTable);
  return hasTable;
}

/**
 * Get data from result table (legacy compatibility)
 * @returns Array of submission data
 */
export function findFromResultTable(): SubmissionData[] {
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
 * Compare two submissions to determine which is better
 * Priority: score > runtime > memory > codeLength > submissionId
 * @param a - First submission
 * @param b - Second submission
 * @returns Comparison result (negative if a is better)
 */
export function compareSubmission(a: SubmissionData, b: SubmissionData): number {
  const aResult = a.result || "";
  const bResult = b.result || "";
  const aRuntime = parseInt(a.runtime || "0", 10);
  const bRuntime = parseInt(b.runtime || "0", 10);
  const aMemory = parseInt(a.memory || "0", 10);
  const bMemory = parseInt(b.memory || "0", 10);
  const aCodeLength = parseInt(a.codeLength || "0", 10);
  const bCodeLength = parseInt(b.codeLength || "0", 10);
  const aSubmissionId = parseInt(a.submissionId || "0", 10);
  const bSubmissionId = parseInt(b.submissionId || "0", 10);

  return hasNotSubtask(aResult, bResult)
    ? aRuntime === bRuntime
      ? aMemory === bMemory
        ? aCodeLength === bCodeLength
          ? -(aSubmissionId - bSubmissionId)
          : aCodeLength - bCodeLength
        : aMemory - bMemory
      : aRuntime - bRuntime
    : compareResult(aResult, bResult);
}

/**
 * Check if submissions don't have subtask scores
 * @param a - Result string a
 * @param b - Result string b
 * @returns True if neither has subtask score
 */
export function hasNotSubtask(a: string, b: string): boolean {
  const aIsNaN = Number.isNaN(parseNumberFromString(a));
  const bIsNaN = Number.isNaN(parseNumberFromString(b));
  return aIsNaN && bIsNaN;
}

/**
 * Compare subtask results by score
 * @param a - Result string a
 * @param b - Result string b
 * @returns Score difference (b - a)
 */
export function compareResult(a: string, b: string): number {
  return parseNumberFromString(b) - parseNumberFromString(a);
}

/**
 * Select best submission for each problem/language combination
 * @param submissions - List of submissions
 * @returns Best submissions without duplicates
 */
export function selectBestSubmissionList(submissions: SubmissionData[]): SubmissionData[] {
  if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
    return [];
  }

  try {
    const grouped = maxValuesGroupBykey(submissions, ["problemId", "language"], compareSubmission);
    log.debug("selectBestSubmissionList - grouped submissions:", grouped);
    return grouped as SubmissionData[];
  } catch (error) {
    log.error("selectBestSubmissionList - Error:", error);
    return submissions;
  }
}

/**
 * Convert result table header to standard field name
 * @param header - Korean header text
 * @returns Standard field name
 */
export function convertResultTableHeader(header: string): string {
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
 * Remove version number from programming language name
 * @param lang - Language name with version
 * @param ignores - Set of languages to ignore (don't remove version)
 * @returns Language name without version
 */
export function langVersionRemove(lang: string, ignores: Set<string> | null): string {
  if (!lang) return "";

  const ignoredLanguages = ignores || new Set(["PyPy3", "PyPy2", "node.js"]);

  if (ignoredLanguages.has(lang)) {
    return lang;
  }

  // Remove version numbers and dots (e.g., "Python 3.8" -> "Python", "Java 11" -> "Java")
  return lang.replace(/\s+[\d.]+.*$/, "").trim();
}
