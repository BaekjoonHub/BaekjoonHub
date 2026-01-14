/**
 * SWEA-specific storage with TTL caching
 * Handles problem data caching with automatic expiration
 *
 * Refactored to use CacheRepository for code deduplication
 */
import { CacheRepository } from "@/commons/cache-repository";

// Problem cache data interface
export interface SWEAProblemCacheData {
  code?: string;
  contestProbId?: string;
}

// Create cache instance using CacheRepository
const problemCache = new CacheRepository<SWEAProblemCacheData>("swea_problems", {
  ttl: 7 * 86400000, // 7 days
  maxSize: 1000,
});

/**
 * Update problem data with TTL management
 * @param problemId - Problem ID
 * @param obj - Data to save
 */
export async function updateProblemData(
  problemId: string,
  obj: Partial<SWEAProblemCacheData>
): Promise<void> {
  // Get existing data and merge
  const existingData = await problemCache.get(problemId);
  const mergedData = {
    ...existingData,
    ...obj,
  };

  await problemCache.set(problemId, mergedData);
}

/**
 * Get problem data by ID
 * @param problemId - Problem ID
 * @returns Problem data or undefined
 */
export async function getProblemData(
  problemId: string
): Promise<SWEAProblemCacheData | undefined> {
  const data = await problemCache.get(problemId);
  return data ?? undefined;
}
