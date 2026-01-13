/**
 * SW Expert Academy Hub global variables declaration file
 * Includes constants and shared state
 */
import constants from "@/constants/code";
import { createUploadState } from "@/commons/shared-state";
import type { UploadState } from "@/types/platform";

// Re-export languages for SWEA
export const languages = constants.languages.swexpertacademy as Record<string, string>;

// Upload state using shared factory
export const uploadState: UploadState = createUploadState();
