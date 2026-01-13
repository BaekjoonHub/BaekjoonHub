/**
 * Storage-related type definitions
 */

// Storage keys
export interface StorageKeys {
  readonly TOKEN: string;
  readonly USERNAME: string;
  readonly HOOK: string;
  readonly ORG_OPTION: string;
  readonly USE_CUSTOM_TEMPLATE: string;
  readonly DIR_TEMPLATE: string;
  readonly STATS: string;
  readonly MODE_TYPE: string;
  readonly ENABLE: string;
  readonly PIPE: string;
  readonly IS_SYNC: string;
  readonly SWEA: string;
}

// Stats object structure
export interface Stats {
  version?: string;
  branches: Record<string, string>;
  submission: Record<string, unknown>;
  problems?: Record<string, unknown>;
  [cacheName: string]: string | Record<string, unknown> | undefined;
}

// Storage data structure
export interface StorageData {
  [key: string]: unknown;
  token?: string;
  username?: string;
  hook?: string;
  stats?: Stats;
  modeType?: string;
  enable?: boolean;
  useCustomTemplate?: boolean;
  dirTemplate?: string;
  orgOption?: string;
  isSync?: boolean;
  pipe?: boolean;
}

// Chrome storage areas
export type StorageArea = 'local' | 'sync';

// Storage batch update
export interface BatchUpdate {
  key: string;
  value: unknown;
}

// Path update for SHA storage
export interface PathUpdate {
  path: string;
  sha: string;
}
