/**
 * Common UI utility functions
 * Functions used commonly across all platforms
 */
import type { UploadState } from "@/types/platform";

/**
 * Display upload failed icon
 * @param uploadState - Object managing upload state
 */
export function markUploadFailedCSS(uploadState?: UploadState | null): void {
  if (uploadState) {
    uploadState.uploading = false;
  }

  const elem = document.getElementById("baekjoonHubProgressElem");
  if (!elem) return;

  elem.className = "markuploadfailed";
}

/**
 * Set upload timeout
 * No longer needed since using Toast, but kept for compatibility
 *
 * @param uploadState - Object managing upload state
 * @param timeout - Timeout duration (default: 10000ms)
 */
export function startUploadCountDown(uploadState?: UploadState | null, _timeout = 10000): void {
  // Toast를 사용하므로 별도의 타임아웃 처리가 필요 없음
  if (uploadState) {
    uploadState.uploading = true;
  }
}

/**
 * Format date string like Baekjoon's format
 * @example 2023년 9월 23일 16:26:26
 * @param date - Date object
 * @returns Formatted date string
 */
export function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}:${seconds}`;
}

/**
 * Initialize upload UI and show loading icon
 * Receives platform-specific target element and adds loading icon to it
 *
 * @param targetElement - Target element to add loading icon to
 * @param uploadState - Object managing upload state
 * @returns Created loading icon element or null
 */
export function initUploadUI(
  targetElement: HTMLElement | null,
  uploadState?: UploadState | null
): HTMLElement | null {
  if (!targetElement) return null;

  // Toast를 사용하므로 로딩 UI는 더 이상 필요하지 않지만
  // 다른 플랫폼과의 호환성을 위해 기본 구조는 유지
  startUploadCountDown(uploadState);
  return null;
}

/**
 * Display upload completed icon and link to GitHub
 *
 * @param branches - Branch info ('userName/repositoryName': 'branchName')
 * @param directory - Directory path ('백준/Gold/1000. A+B')
 * @param uploadState - Object managing upload state
 */
export function markUploadedCSS(
  branches: Record<string, string>,
  directory: string,
  uploadState?: UploadState | null
): void {
  if (uploadState) {
    uploadState.uploading = false;
  }

  const elem = document.getElementById("baekjoonHubProgressElem");
  if (!elem) return;

  elem.className = "markuploaded";

  // Create GitHub link
  const repoName = Object.keys(branches)[0];
  const branchName = branches[repoName];
  const uploadedUrl = `https://github.com/${repoName}/tree/${branchName}/${directory}`;

  // Register click event
  elem.addEventListener("click", () => {
    window.location.href = uploadedUrl;
  });
  elem.style.cursor = "pointer";
}

/**
 * Convert image tag relative URLs to absolute URLs
 *
 * @param element - Document or HTMLElement to process
 */
export function convertImageTagToAbsoluteURL(element: Document | HTMLElement = document): void {
  if (!element) return;

  // Find img tags and convert src attributes to absolute paths
  Array.from(element.getElementsByTagName("img")).forEach((img) => {
    if (img.currentSrc) {
      img.setAttribute("src", img.currentSrc);
    }
  });
}
