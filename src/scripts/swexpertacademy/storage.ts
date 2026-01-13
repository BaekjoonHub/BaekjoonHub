/**
 * SWEA-specific storage with TTL caching
 * Handles problem data caching with automatic expiration
 */
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage";
import { isNull } from "@/commons/util";
import { STORAGE_KEYS } from "@/constants/registry";
import log from "@/commons/logger";

// Problem cache data interface
interface SWEAProblemCacheData {
  code?: string;
  contestProbId?: string;
  save_date?: number;
  saveDate?: number;
}

// SWEA storage data interface
interface SWEAStorageData {
  [problemId: string]: SWEAProblemCacheData | undefined;
}

// Initialize SWEA storage
(async () => {
  const data = await getObjectFromLocalStorage<SWEAStorageData>(STORAGE_KEYS.SWEA);
  if (isNull(data)) {
    await saveObjectInLocalStorage({ [STORAGE_KEYS.SWEA]: {} });
  }
})();

/**
 * Update problem data with TTL management
 * Automatically removes entries older than a week
 * @param problemId - Problem ID
 * @param obj - Data to save
 * @returns Updated data object
 */
export async function updateProblemData(
  problemId: string,
  obj: Partial<SWEAProblemCacheData>
): Promise<SWEAStorageData> {
  const data = (await getObjectFromLocalStorage<SWEAStorageData>(STORAGE_KEYS.SWEA)) || {};
  log.debug("updateProblemData", data);
  log.debug("obj", obj);

  if (isNull(data[problemId])) {
    data[problemId] = {};
  }

  data[problemId] = {
    ...data[problemId],
    ...obj,
    save_date: Date.now(),
  };

  // Remove entries older than a week
  const dateWeekAgo = Date.now() - 7 * 86400000;
  log.debug("data before deletion", data);
  log.debug("date a week ago", dateWeekAgo);

  for (const [key, value] of Object.entries(data)) {
    if (isNull(value) || isNull(value.saveDate)) {
      delete data[key];
      continue;
    }
    const saveDate = new Date(value.saveDate).getTime();
    if (dateWeekAgo > saveDate) {
      delete data[key];
    }
  }

  await saveObjectInLocalStorage({ [STORAGE_KEYS.SWEA]: data });
  return data;
}

/**
 * Get problem data by ID
 * @param problemId - Problem ID
 * @returns Problem data or undefined
 */
export async function getProblemData(
  problemId: string
): Promise<SWEAProblemCacheData | undefined> {
  const data = (await getObjectFromLocalStorage<SWEAStorageData>(STORAGE_KEYS.SWEA)) || {};
  return data[problemId];
}
