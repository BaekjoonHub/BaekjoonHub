/**
 * Programmers platform utility functions
 * Handles UI notifications using shared upload-notifications service
 */
import { uploadState } from "@/programmers/variables";
import { createUploadNotifications } from "@/commons/upload-notifications";
import log from "@/commons/logger";

// Create notification service for Programmers
const notifications = createUploadNotifications("프로그래머스", uploadState);

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
