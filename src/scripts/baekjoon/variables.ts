/**
 * Baekjoon Hub global variables declaration file
 * Includes constants and shared state
 */
import constants from "@/constants/code";
import { createUploadState } from "@/commons/shared-state";
import type { UploadState } from "@/types/platform";

// Re-export constants for backward compatibility
export const languages = constants.languages;
export const bjLevel = constants.bjLevel;
export const RESULT_CATEGORY = constants.RESULT_CATEGORY;
export const RESULT_MESSAGE = constants.RESULT_MESSAGE;

// Upload state using shared factory
export const uploadState: UploadState = createUploadState();

// Multi-loader state for batch operations
export interface MultiLoaderState {
  wrap: HTMLElement | null;
  nom: HTMLElement | null;
  denom: HTMLElement | null;
}

export const multiloader: MultiLoaderState = {
  wrap: null,
  nom: null,
  denom: null,
};
