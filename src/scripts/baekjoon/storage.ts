/**
 * Baekjoon-specific storage with TTL caching
 * Handles problem data, submission code, and Solved.ac data caching
 */
import { getStats, saveStats } from "@/commons/storage";
import { isNull } from "@/commons/util";
import log from "@/commons/logger";
import type { Stats } from "@/types/storage";

// Cached data item interface
interface CacheItem<T = unknown> {
  id: string | number;
  save_date?: number;
  data?: T;
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
}

// Cache stats structure
interface CacheStats {
  [key: string]: CacheItem | number | undefined;
  last_check_date?: number;
}

/**
 * TTL-based cache stats manager
 * Automatically expires cached data after a week
 */
export class TTLCacheStats {
  private name: string;
  private stats: Stats | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Force reload stats from storage
   */
  async forceLoad(): Promise<void> {
    this.stats = await getStats();
    if (isNull(this.stats)) {
      this.stats = {
        version: "0.0.0",
        branches: {},
        submission: {},
        problems: {},
      };
    }
    if (isNull((this.stats as Record<string, unknown>)[this.name])) {
      (this.stats as Record<string, CacheStats>)[this.name] = {};
    }
  }

  /**
   * Load stats if not already loaded
   */
  async load(): Promise<void> {
    if (this.stats === null) {
      await this.forceLoad();
    }
  }

  /**
   * Save stats with debouncing (1 second delay)
   */
  async save(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(async () => {
      const clone = (this.stats as Record<string, CacheStats>)[this.name];
      log.debug("Saving stats...", clone);
      await this.forceLoad();
      (this.stats as Record<string, CacheStats>)[this.name] = clone;
      await saveStats(this.stats!);
      this.saveTimer = null;
    }, 1000);
  }

  /**
   * Check and clean expired cache entries
   */
  async expired(): Promise<void> {
    await this.load();
    if (isNull(this.stats) || isNull((this.stats as Record<string, CacheStats>)[this.name])) {
      await this.forceLoad();
    }

    const cacheData = (this.stats as Record<string, CacheStats>)[this.name];

    if (!cacheData.last_check_date) {
      cacheData.last_check_date = Date.now();
      await this.save();
      log.debug("Initialized stats date", cacheData.last_check_date);
      return;
    }

    const dateYesterday = Date.now() - 86400000; // 1 day
    log.debug("금일 로컬스토리지 정리를 완료하였습니다.");
    if (dateYesterday < cacheData.last_check_date) return;

    // Delete items older than a week
    const dateWeekAgo = Date.now() - 7 * 86400000;
    log.debug("stats before deletion", this.stats);
    log.debug("date a week ago", dateWeekAgo);

    for (const [key, value] of Object.entries(cacheData)) {
      if (key === "last_check_date") continue;

      const item = value as CacheItem | undefined;
      if (!item || !item.save_date) {
        delete cacheData[key];
      } else {
        const saveDate = new Date(item.save_date).getTime();
        if (dateWeekAgo > saveDate) {
          delete cacheData[key];
        }
      }
    }

    cacheData.last_check_date = Date.now();
    log.debug("stats after deletion", this.stats);
    await this.save();
  }

  /**
   * Update cache with new data
   */
  async update(data: CacheItem): Promise<void> {
    await this.expired();
    await this.load();

    const cacheData = (this.stats as Record<string, CacheStats>)[this.name];
    cacheData[data.id] = {
      ...data,
      save_date: Date.now(),
    };

    log.debug("date", (cacheData[data.id] as CacheItem).save_date);
    log.debug("stats", this.stats);
    await this.save();
  }

  /**
   * Get cached data by ID
   */
  async get(id: string | number): Promise<CacheItem | null> {
    await this.load();
    if (isNull(this.stats) || isNull((this.stats as Record<string, CacheStats>)[this.name])) {
      return null;
    }
    const cacheData = (this.stats as Record<string, CacheStats>)[this.name];
    if (isNull(cacheData)) return null;
    return (cacheData[id] as CacheItem) || null;
  }
}

// Cache instances
const problemCache = new TTLCacheStats("problem");
const submitCodeCache = new TTLCacheStats("scode");
const SolvedACCache = new TTLCacheStats("solvedac");

// Problem data interface
interface ProblemCacheData {
  problemId: string;
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
}

/**
 * Update cached problem data
 */
export async function updateProblemData(problem: ProblemCacheData): Promise<void> {
  const data: CacheItem = {
    id: problem.problemId,
    problemDescription: problem.problemDescription || problem.problem_description,
    problemInput: problem.problemInput || problem.problem_input,
    problemOutput: problem.problemOutput || problem.problem_output,
  };
  await problemCache.update(data);
}

/**
 * Get cached problem data by ID
 */
export async function getProblemData(problemId: string | number): Promise<CacheItem | null> {
  return problemCache.get(problemId);
}

// Submit code data interface
interface SubmitCodeCacheData {
  submissionId: string | number;
  code: string;
}

/**
 * Update cached submission code
 */
export async function updateSubmitCodeData(obj: SubmitCodeCacheData): Promise<void> {
  const data: CacheItem = {
    id: obj.submissionId,
    data: obj.code,
  };
  await submitCodeCache.update(data);
}

/**
 * Get cached submission code by ID
 */
export async function getSubmitCodeData(submissionId: string | number): Promise<string | null> {
  const item = await submitCodeCache.get(submissionId);
  return item?.data as string | null;
}

// Solved.ac data interface
interface SolvedACCacheData {
  problemId: string | number;
  jsonData: unknown;
}

/**
 * Update cached Solved.ac data
 */
export async function updateSolvedACData(obj: SolvedACCacheData): Promise<void> {
  const data: CacheItem = {
    id: obj.problemId,
    data: obj.jsonData,
  };
  await SolvedACCache.update(data);
}

/**
 * Get cached Solved.ac data by ID
 */
export async function getSolvedACData(problemId: string | number): Promise<unknown | null> {
  const item = await SolvedACCache.get(problemId);
  return item?.data ?? null;
}
