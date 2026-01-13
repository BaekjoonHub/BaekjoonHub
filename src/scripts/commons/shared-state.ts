/**
 * Shared state factory for all platforms
 * Creates platform-specific upload state objects
 */
import type { UploadState } from "@/types/platform";

/**
 * Create a new upload state object
 * @returns New upload state with uploading set to false
 */
export function createUploadState(): UploadState {
  return { uploading: false };
}

/**
 * Reset upload state to default values
 * @param state - State to reset
 */
export function resetUploadState(state: UploadState): void {
  state.uploading = false;
}

/**
 * Mark upload as started
 * @param state - State to update
 */
export function markUploadStarted(state: UploadState): void {
  state.uploading = true;
}

/**
 * Mark upload as completed
 * @param state - State to update
 */
export function markUploadCompleted(state: UploadState): void {
  state.uploading = false;
}

/**
 * Check if currently uploading
 * @param state - State to check
 * @returns Whether uploading is in progress
 */
export function isUploading(state: UploadState): boolean {
  return state.uploading;
}
