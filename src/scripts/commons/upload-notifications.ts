/**
 * Unified upload notification service
 * Provides consistent notification handling across all platforms
 * Reduces ~280 lines of duplicate code across 4 platform util.js files
 */
import { Toast } from "@/commons/toast";
import log from "@/commons/logger";
import type { UploadState, PlatformName } from "@/types/platform";
import { markUploadStarted, markUploadCompleted } from "./shared-state";

/**
 * Upload notification service class
 * Handles all upload-related notifications for a specific platform
 */
export class UploadNotificationService {
  private platformName: string;
  private uploadState: UploadState;

  constructor(platformName: string, uploadState: UploadState) {
    this.platformName = platformName;
    this.uploadState = uploadState;
  }

  /**
   * Notify user that upload has started
   */
  startUpload(): void {
    markUploadStarted(this.uploadState);
    Toast.info(`${this.platformName} GitHub 업로드를 시작합니다!`, 3000);
    log.info(`${this.platformName} upload started`);
  }

  /**
   * Notify user of successful upload with GitHub link
   * @param branches - Branch info (repoName: branchName)
   * @param directory - Directory path
   */
  markUploadSuccess(branches: Record<string, string>, directory: string): void {
    markUploadCompleted(this.uploadState);

    // Build GitHub URL
    const repoName = Object.keys(branches)[0];
    const branchName = branches[repoName];
    const uploadedUrl = `https://github.com/${repoName}/tree/${branchName}/${encodeURIComponent(directory)}`;

    // Show success toast with clickable link
    const toast = Toast.success(
      `${this.platformName} 업로드 완료! 클릭하여 GitHub에서 확인`,
      8000
    );

    // Add click handler to open GitHub link
    if (toast.element) {
      toast.element.addEventListener("click", () => {
        window.open(uploadedUrl, "_blank");
      });
    }

    log.info(`${this.platformName} upload success:`, uploadedUrl);
  }

  /**
   * Notify user of upload failure
   * @param errorMessage - Optional error message to display
   */
  markUploadFailed(errorMessage?: string): void {
    markUploadCompleted(this.uploadState);

    const message = errorMessage
      ? `${this.platformName} 업로드 실패: ${errorMessage}`
      : `${this.platformName} 업로드 실패!`;

    Toast.danger(message, 6000);
    log.error(`${this.platformName} upload failed:`, errorMessage);
  }

  /**
   * Notify user that upload was skipped (already uploaded)
   */
  markUploadSkipped(): void {
    markUploadCompleted(this.uploadState);
    Toast.info(`${this.platformName}: 이미 업로드된 제출입니다.`, 3000);
    log.info(`${this.platformName} upload skipped (already uploaded)`);
  }

  /**
   * Show generic info notification
   * @param message - Message to display
   * @param duration - Duration in ms (default: 4000)
   */
  showInfo(message: string, duration = 4000): void {
    Toast.info(message, duration);
  }

  /**
   * Show generic warning notification
   * @param message - Message to display
   * @param duration - Duration in ms (default: 5000)
   */
  showWarning(message: string, duration = 5000): void {
    Toast.warning(message, duration);
  }

  /**
   * Check if currently uploading
   */
  isUploading(): boolean {
    return this.uploadState.uploading;
  }
}

/**
 * Factory function to create upload notification service
 * @param platformName - Name of the platform
 * @param uploadState - Upload state object to manage
 */
export function createUploadNotifications(
  platformName: PlatformName | string,
  uploadState: UploadState
): UploadNotificationService {
  return new UploadNotificationService(platformName, uploadState);
}

// Convenience functions for quick access without creating service instance

/**
 * Show upload start notification (standalone)
 * @param platformName - Platform name
 */
export function notifyUploadStart(platformName: string): void {
  Toast.info(`${platformName} GitHub 업로드를 시작합니다!`, 3000);
}

/**
 * Show upload success notification with GitHub link (standalone)
 * @param platformName - Platform name
 * @param branches - Branch info
 * @param directory - Directory path
 */
export function notifyUploadSuccess(
  platformName: string,
  branches: Record<string, string>,
  directory: string
): void {
  const repoName = Object.keys(branches)[0];
  const branchName = branches[repoName];
  const uploadedUrl = `https://github.com/${repoName}/tree/${branchName}/${encodeURIComponent(directory)}`;

  const toast = Toast.success(
    `${platformName} 업로드 완료! 클릭하여 GitHub에서 확인`,
    8000
  );

  if (toast.element) {
    toast.element.addEventListener("click", () => {
      window.open(uploadedUrl, "_blank");
    });
  }
}

/**
 * Show upload failure notification (standalone)
 * @param platformName - Platform name
 * @param errorMessage - Optional error message
 */
export function notifyUploadFailed(platformName: string, errorMessage?: string): void {
  const message = errorMessage
    ? `${platformName} 업로드 실패: ${errorMessage}`
    : `${platformName} 업로드 실패!`;

  Toast.danger(message, 6000);
}
