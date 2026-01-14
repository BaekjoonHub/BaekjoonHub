/**
 * Chrome Storage API wrapper for BaekjoonHub
 * Provides typed access to chrome.storage.local and chrome.storage.sync
 *
 * Refactored to use ChromeStorageAdapter for better separation of concerns
 */

import { isNull } from "./util";
import { STORAGE_KEYS } from "@/constants/registry";
import { GitHub } from "./github";
import EnhancedTemplateService from "./enhanced-template";
import log from "@/commons/logger";
import { chromeStorageAdapter } from "./storage-adapter";
import type { Stats, StorageData } from "@/types/storage";
import type { PlatformName } from "@/types/platform";

/**
 * Get current extension version
 * @returns The current extension version
 */
export function getVersion(): string {
  return chrome.runtime.getManifest().version;
}

/**
 * Get object from Chrome Local Storage
 * @param key - Storage key or array of keys
 * @returns Promise resolving to stored value
 */
export async function getObjectFromLocalStorage<T = unknown>(key: string | string[]): Promise<T | undefined> {
  log.info("storage.ts: getObjectFromLocalStorage called with key:", key);
  return chromeStorageAdapter.get<T>(key, "local");
}

/**
 * Save object to Chrome Local Storage
 * @param obj - Object to save
 */
export async function saveObjectInLocalStorage(obj: Record<string, unknown>): Promise<void> {
  log.info("storage.ts: saveObjectInLocalStorage called with obj:", obj);
  return chromeStorageAdapter.set(obj, "local");
}

/**
 * Remove object from Chrome Local Storage
 * @param keys - Key or array of keys to remove
 */
export async function removeObjectFromLocalStorage(keys: string | string[]): Promise<void> {
  log.info("storage.ts: removeObjectFromLocalStorage called with keys:", keys);
  return chromeStorageAdapter.remove(keys, "local");
}

/**
 * Get object from Chrome Sync Storage
 * @param key - Storage key
 * @returns Promise resolving to stored value
 */
export async function getObjectFromSyncStorage<T = unknown>(key: string): Promise<T | undefined> {
  log.info("storage.ts: getObjectFromSyncStorage called with key:", key);
  return chromeStorageAdapter.get<T>(key, "sync");
}

/**
 * Save object to Chrome Sync Storage
 * @param obj - Object to save
 */
export async function saveObjectInSyncStorage(obj: Record<string, unknown>): Promise<void> {
  log.info("storage.ts: saveObjectInSyncStorage called with obj:", obj);
  return chromeStorageAdapter.set(obj, "sync");
}

/**
 * Remove object from Chrome Sync Storage
 * @param keys - Key or array of keys to remove
 */
export async function removeObjectFromSyncStorage(keys: string | string[]): Promise<void> {
  log.info("storage.ts: removeObjectFromSyncStorage called with keys:", keys);
  return chromeStorageAdapter.remove(keys, "sync");
}

// ============ Convenience getters/setters ============

export async function getToken(): Promise<string | undefined> {
  return getObjectFromLocalStorage<string>(STORAGE_KEYS.TOKEN);
}

export async function getGithubUsername(): Promise<string | undefined> {
  return getObjectFromLocalStorage<string>(STORAGE_KEYS.USERNAME);
}

export async function getStats(): Promise<Stats> {
  const stats = await getObjectFromLocalStorage<Stats>(STORAGE_KEYS.STATS);

  // Return default object if stats is null or undefined
  if (!stats) {
    const defaultStats: Stats = {
      version: "0.0.0",
      branches: {},
      submission: {},
      problems: {},
    };
    await saveStats(defaultStats);
    return defaultStats;
  }

  // Ensure all required fields exist
  if (!stats.branches) stats.branches = {};
  if (!stats.submission) stats.submission = {};
  if (!stats.problems) stats.problems = {};
  if (!stats.version) stats.version = "0.0.0";

  return stats;
}

export async function getHook(): Promise<string | undefined> {
  return getObjectFromLocalStorage<string>(STORAGE_KEYS.HOOK);
}

/** @deprecated settings.html dis_option에서 설정된 값을 반환합니다. 현재는 사용되지 않습니다. */
export async function getOrgOption(): Promise<string> {
  try {
    const value = await getObjectFromLocalStorage<string>(STORAGE_KEYS.ORG_OPTION);
    return value ?? "platform";
  } catch (ex) {
    log.warn("The way it works has changed with updates. Update your storage.");
    await saveObjectInLocalStorage({ [STORAGE_KEYS.ORG_OPTION]: "platform" });
    return "platform";
  }
}

export async function getModeType(): Promise<string | undefined> {
  return getObjectFromLocalStorage<string>(STORAGE_KEYS.MODE_TYPE);
}

export async function saveToken(token: string): Promise<void> {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.TOKEN]: token });
}

export async function saveStats(stats: Stats): Promise<void> {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.STATS]: stats });
}

// ============ Path filters for stats ============

export function _baekjoonRankRemoverFilter(path: string): string {
  return path.replace(/\/(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)\//g, "/");
}

export function _programmersRankRemoverFilter(path: string): string {
  return path.replace(/\/(lv[0-9]|unrated)\//g, "/");
}

export function _baekjoonSpaceRemoverFilter(path: string): string {
  return path.replace(/( | |&nbsp|&#160|&#8197|%E2%80%85|%20)/g, "");
}

export function _swexpertacademyRankRemoveFilter(path: string): string {
  return path.replace(/\/D([0-8]+)\//g, "/");
}

/**
 * Apply all path filters
 */
function applyPathFilters(path: string): string {
  return _swexpertacademyRankRemoveFilter(
    _baekjoonSpaceRemoverFilter(_programmersRankRemoverFilter(_baekjoonRankRemoverFilter(path)))
  );
}

// ============ Object path utilities ============

type NestedObject = Record<string, unknown>;

/**
 * Update nested object data from path
 * @param obj - Target object
 * @param path - Path like "owner/repo/folder/file.js"
 * @param data - Data to set at path
 */
export function updateObjectDatafromPath(obj: NestedObject | null | undefined, path: string, data: unknown): void {
  if (!obj) {
    log.error("updateObjectDatafromPath: obj is null or undefined", { obj, path, data });
    return;
  }

  try {
    let current: NestedObject = obj;
    const pathArray = applyPathFilters(path)
      .split("/")
      .filter((p) => p !== "");

    for (const p of pathArray.slice(0, -1)) {
      if (isNull(current[p])) {
        current[p] = {};
      }
      current = current[p] as NestedObject;
    }

    const lastKey = pathArray.pop();
    if (lastKey) {
      current[lastKey] = data;
    }
  } catch (error) {
    log.error("updateObjectDatafromPath error:", error, { obj, path, data });
  }
}

/**
 * Get nested object data from path
 * @param obj - Source object
 * @param path - Path like "owner/repo/folder/file.js"
 * @returns Data at path or null
 */
export function getObjectDatafromPath(obj: NestedObject | null | undefined, path: string): unknown {
  if (!obj) {
    log.warn("getObjectDatafromPath: obj is null or undefined", { obj, path });
    return null;
  }

  try {
    let current: NestedObject = obj;
    const pathArray = applyPathFilters(path)
      .split("/")
      .filter((p) => p !== "");

    for (const p of pathArray.slice(0, -1)) {
      if (isNull(current[p])) {
        return null;
      }
      current = current[p] as NestedObject;
    }

    const lastKey = pathArray.pop();
    return lastKey ? current[lastKey] : null;
  } catch (error) {
    log.error("getObjectDatafromPath error:", error, { obj, path });
    return null;
  }
}

/**
 * Update stats SHA from path
 */
export async function updateStatsSHAfromPath(path: string, sha: string): Promise<void> {
  const stats = await getStats();

  if (!stats.submission) {
    stats.submission = {};
  }

  updateObjectDatafromPath(stats.submission as NestedObject, path, sha);
  await saveStats(stats);
}

/**
 * Get stats SHA from path
 */
export async function getStatsSHAfromPath(path: string): Promise<string | null> {
  const stats = await getStats();

  if (!stats.submission) {
    return null;
  }

  return getObjectDatafromPath(stats.submission as NestedObject, path) as string | null;
}

/**
 * Update local storage stats from GitHub repository
 */
export async function updateLocalStorageStats(): Promise<Stats> {
  try {
    const hook = await getHook();
    const token = await getToken();

    if (!hook || !token) {
      log.error("Missing hook or token for updateLocalStorageStats", { hook, token });
      return await getStats();
    }

    const git = new GitHub(hook, token);
    const stats = await getStats();

    interface TreeItem {
      type: string;
      path: string;
      sha: string;
    }

    const treeItems: TreeItem[] = [];

    // Ensure required fields exist
    if (!stats.submission) stats.submission = {};
    if (!stats.branches) stats.branches = {};

    try {
      const tree = await git.getTree();
      if (Array.isArray(tree)) {
        tree.forEach((item: TreeItem) => {
          if (item && item.type === "blob" && item.path) {
            treeItems.push(item);
          }
        });
      } else {
        log.warn("getTree returned invalid data:", tree);
      }
    } catch (error) {
      log.error("Error getting tree from GitHub:", error);
    }

    // Update submission data
    if (stats.submission) {
      treeItems.forEach((item) => {
        try {
          updateObjectDatafromPath(stats.submission as NestedObject, `${hook}/${item.path}`, item.sha);
        } catch (error) {
          log.error("Error updating object data from path:", error, item);
        }
      });
    }

    // Get default branch
    try {
      const defaultBranch = await git.getDefaultBranchOnRepo();
      if (defaultBranch && stats.branches) {
        stats.branches[hook] = defaultBranch;
      }
    } catch (error) {
      log.error("Error getting default branch:", error);
      if (stats.branches) {
        stats.branches[hook] = "main";
      }
    }

    await saveStats(stats);
    log.debug("update stats", stats);
    return stats;
  } catch (error) {
    log.error("Critical error in updateLocalStorageStats:", error);
    return await getStats();
  }
}

/**
 * Get directory name by template
 * Supports both legacy org_option behavior and custom templates
 */
export async function getDirNameByTemplate(
  dirName: string,
  language: string,
  data: Record<string, unknown> | null = null
): Promise<string> {
  try {
    let platform: PlatformName | "" = "";
    if (dirName.startsWith("백준/")) {
      platform = "백준";
    } else if (dirName.startsWith("프로그래머스/")) {
      platform = "프로그래머스";
    } else if (dirName.startsWith("SWEA/")) {
      platform = "SW Expert Academy";
    }

    const useCustomTemplate = await getObjectFromLocalStorage<boolean>(STORAGE_KEYS.USE_CUSTOM_TEMPLATE);
    const customTemplate = await getObjectFromLocalStorage<string>(STORAGE_KEYS.DIR_TEMPLATE);

    if (useCustomTemplate && customTemplate) {
      return EnhancedTemplateService.getDirNameWithTemplate(
        platform,
        dirName,
        language,
        data,
        true,
        customTemplate,
        "custom"
      );
    }

    // Legacy org_option behavior for backwards compatibility
    const orgOption = await getOrgOption();
    if (orgOption === "language") {
      return `${language}/${dirName}`;
    }

    // Default: platform option - return dirName as-is
    return dirName;
  } catch (error) {
    log.error("디렉토리 구조 생성 중 오류가 발생했습니다:", error);
    return dirName;
  }
}

/**
 * Initialize storage with sync from chrome.storage.sync
 */
export function initializeStorage(): void {
  getObjectFromLocalStorage<{ isSync?: boolean }>(STORAGE_KEYS.IS_SYNC).then((data) => {
    const keys = [
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USERNAME,
      STORAGE_KEYS.PIPE,
      STORAGE_KEYS.STATS,
      STORAGE_KEYS.HOOK,
      STORAGE_KEYS.MODE_TYPE,
    ];

    if (data && data.isSync) {
      log.info("BaekjoonHub Local storage already synced!");
      return;
    }

    keys.forEach(async (key) => {
      const localValue = await getObjectFromLocalStorage(key);
      if (isNull(localValue)) {
        chrome.storage.sync.get(key, (syncData: Record<string, unknown>) => {
          saveObjectInLocalStorage({ [key]: syncData[key] });
        });
      }
    });

    saveObjectInLocalStorage({ [STORAGE_KEYS.IS_SYNC]: true }).then(() => {
      log.info("BaekjoonHub Synced to local values");
    });
  });

  getStats().then((stats) => {
    let needsUpdate = false;

    if (!stats.version || stats.version === "0.0.0") {
      stats.version = getVersion();
      needsUpdate = true;
    }

    if (!stats.branches || stats.version !== getVersion()) {
      stats.branches = {};
      needsUpdate = true;
    }

    if (!stats.submission || stats.version !== getVersion()) {
      stats.submission = {};
      needsUpdate = true;
    }

    if (!stats.problems || stats.version !== getVersion()) {
      stats.problems = {};
      needsUpdate = true;
    }

    if (stats.version !== getVersion()) {
      stats.version = getVersion();
      needsUpdate = true;
    }

    if (needsUpdate) {
      saveStats(stats);
    }
  });
}

// ============ AI Review helpers ============

/**
 * Get OpenAI API token
 */
export async function getOpenAIToken(): Promise<string | undefined> {
  return getObjectFromLocalStorage<string>(STORAGE_KEYS.OPENAI_TOKEN);
}

/**
 * Save OpenAI API token
 */
export async function saveOpenAIToken(token: string): Promise<void> {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.OPENAI_TOKEN]: token });
}

/**
 * Get AI review enabled status
 */
export async function getAIReviewEnabled(): Promise<boolean> {
  const enabled = await getObjectFromLocalStorage<boolean>(STORAGE_KEYS.AI_REVIEW_ENABLED);
  return enabled === true;
}

/**
 * Save AI review enabled status
 */
export async function saveAIReviewEnabled(enabled: boolean): Promise<void> {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.AI_REVIEW_ENABLED]: enabled });
}

/**
 * Get AI review custom prompt
 */
export async function getAIReviewPrompt(): Promise<string | undefined> {
  return getObjectFromLocalStorage<string>(STORAGE_KEYS.AI_REVIEW_PROMPT);
}

/**
 * Save AI review custom prompt
 */
export async function saveAIReviewPrompt(prompt: string): Promise<void> {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.AI_REVIEW_PROMPT]: prompt });
}
