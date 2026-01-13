/**
 * Migration key mappings for BaekjoonHub v1.x to v2.0.0
 * Defines how old storage keys map to new storage keys
 */

import { STORAGE_KEYS } from "@/constants/registry";

/**
 * v1.x to v2.0.0 key mapping
 * Maps old key names to new standardized key names
 */
export const V1_TO_V2_KEY_MAPPING: Record<string, string> = {
  // Direct mappings (value stays the same)
  BaekjoonHub_token: STORAGE_KEYS.TOKEN,
  BaekjoonHub_username: STORAGE_KEYS.USERNAME,
  BaekjoonHub_hook: STORAGE_KEYS.HOOK,
  pipe_baekjoonhub: STORAGE_KEYS.PIPE,
  isSync: STORAGE_KEYS.IS_SYNC,

  // Keys with different naming convention
  mode_type: STORAGE_KEYS.MODE_TYPE,
  bjhEnable: STORAGE_KEYS.ENABLE,
  stats: STORAGE_KEYS.STATS,
  BaekjoonHub_OrgOption: STORAGE_KEYS.ORG_OPTION,
} as const;

/**
 * Default values for v2.0.0 new keys
 * These keys don't exist in v1.x
 */
export const V2_NEW_KEYS_DEFAULTS: Record<string, unknown> = {
  [STORAGE_KEYS.USE_CUSTOM_TEMPLATE]: false,
  [STORAGE_KEYS.DIR_TEMPLATE]: "{{platform}}/{{removeAfterSpace(level)}}/{{problemId}}. {{title}}",
  [STORAGE_KEYS.SWEA]: null,
} as const;

/**
 * v1 keys to delete after migration
 * Includes all mapped keys and Goorm-related keys (unsupported in v2)
 */
export const V1_KEYS_TO_DELETE: string[] = [
  // Mapped keys
  "BaekjoonHub_token",
  "BaekjoonHub_username",
  "BaekjoonHub_hook",
  "mode_type",
  "bjhEnable",
  "stats",
  "isSync",
  "pipe_baekjoonhub",
  "BaekjoonHub_OrgOption",
  "BaekjoonHub_disOption", // deprecated in v1.x

  // Goorm-related keys (unsupported in v2.0.0)
  "goormlevel_token",
  "goormlevel_hook",
  "goormlevel_stats",
  "goormlevel_enable",
] as const;

/**
 * Template presets for OrgOption conversion
 */
export const ORG_OPTION_TEMPLATES: Record<string, string> = {
  platform: "{{platform}}/{{removeAfterSpace(level)}}/{{problemId}}. {{title}}",
  language: "{{language}}/{{platform}}/{{removeAfterSpace(level)}}/{{problemId}}. {{title}}",
} as const;
