/**
 * Storage keys registry for BaekjoonHub
 */

export const STORAGE_KEYS = {
  TOKEN: "baekjoonhub_token",
  USERNAME: "baekjoonhub_username",
  HOOK: "baekjoonhub_hook",
  ORG_OPTION: "baekjoonhub_org_option",
  USE_CUSTOM_TEMPLATE: "baekjoonhub_use_custom_template",
  DIR_TEMPLATE: "baekjoonhub_dir_template",
  STATS: "baekjoonhub_stats",
  MODE_TYPE: "baekjoonhub_mode_type",
  ENABLE: "baekjoonhub_enable",
  PIPE: "baekjoonhub_pipe",
  IS_SYNC: "baekjoonhub_is_sync",
  SWEA: "baekjoonhub_swea",
  MIGRATION_VERSION: "baekjoonhub_migration_version",
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;
export type StorageKeyValue = (typeof STORAGE_KEYS)[StorageKey];
