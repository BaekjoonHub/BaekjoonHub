/**
 * Programmers Hub global variables declaration file
 * Includes constants and shared state
 */
import constants from "@/constants/code";
import { createUploadState } from "@/commons/shared-state";
import type { UploadState } from "@/types/platform";

// Re-export constants for backward compatibility
export const levels = constants.programmersLevels;

// Upload state using shared factory
export const uploadState: UploadState = createUploadState();
