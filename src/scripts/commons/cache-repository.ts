/**
 * Generic cache repository with TTL support
 * Provides unified caching interface for all platforms
 */
import { getStats, saveStats } from "@/commons/storage";
import { isNull } from "@/commons/util";
import log from "@/commons/logger";
import type { Stats } from "@/types/storage";

// Cache entry interface
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

// Cache storage structure
interface CacheStorage<T> {
  [key: string]: CacheEntry<T> | number | undefined;
  last_check_date?: number;
}

// Cache repository options
export interface CacheRepositoryOptions {
  ttl?: number; // Time to live in milliseconds (default: 7 days)
  maxSize?: number; // Maximum number of entries
  cleanupInterval?: number; // How often to check for expired entries (default: 1 day)
}

/**
 * Generic cache repository with TTL support
 * Automatically manages cache expiration and cleanup
 */
export class CacheRepository<T> {
  private storageKey: string;
  private stats: Stats | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private ttl: number;
  private cleanupInterval: number;
  private maxSize?: number;

  constructor(storageKey: string, options: CacheRepositoryOptions = {}) {
    this.storageKey = storageKey;
    this.ttl = options.ttl ?? 7 * 86400000; // Default: 7 days
    this.cleanupInterval = options.cleanupInterval ?? 86400000; // Default: 1 day
    this.maxSize = options.maxSize;
  }

  /**
   * Force reload stats from storage
   */
  private async forceLoad(): Promise<void> {
    this.stats = await getStats();
    if (isNull(this.stats)) {
      this.stats = {
        version: "0.0.0",
        branches: {},
        submission: {},
        problems: {},
      };
    }
    if (isNull((this.stats as Record<string, unknown>)[this.storageKey])) {
      (this.stats as Record<string, CacheStorage<T>>)[this.storageKey] = {};
    }
  }

  /**
   * Load stats if not already loaded
   */
  private async load(): Promise<void> {
    if (this.stats === null) {
      await this.forceLoad();
    }
  }

  /**
   * Save stats with debouncing (1 second delay)
   */
  private async save(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(async () => {
      const clone = (this.stats as Record<string, CacheStorage<T>>)[this.storageKey];
      log.debug(`Saving cache [${this.storageKey}]...`, clone);
      await this.forceLoad();
      (this.stats as Record<string, CacheStorage<T>>)[this.storageKey] = clone;
      await saveStats(this.stats!);
      this.saveTimer = null;
    }, 1000);
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  /**
   * Clean up expired entries
   */
  private async cleanup(): Promise<void> {
    await this.load();
    if (isNull(this.stats) || isNull((this.stats as Record<string, CacheStorage<T>>)[this.storageKey])) {
      await this.forceLoad();
    }

    const cacheData = (this.stats as Record<string, CacheStorage<T>>)[this.storageKey];

    // Initialize cleanup timestamp if not exists
    if (!cacheData.last_check_date) {
      cacheData.last_check_date = Date.now();
      await this.save();
      log.debug(`Initialized cache [${this.storageKey}] cleanup date`, cacheData.last_check_date);
      return;
    }

    // Check if cleanup is needed (based on cleanup interval)
    const lastCheck = cacheData.last_check_date;
    if (Date.now() - lastCheck < this.cleanupInterval) {
      return; // Cleanup not needed yet
    }

    // Remove expired entries
    const expireTime = Date.now() - this.ttl;
    log.debug(`Cleaning up cache [${this.storageKey}], expire time:`, expireTime);

    let deletedCount = 0;
    for (const [key, value] of Object.entries(cacheData)) {
      if (key === "last_check_date") continue;

      const entry = value as CacheEntry<T> | undefined;
      if (!entry || !entry.timestamp) {
        delete cacheData[key];
        deletedCount++;
      } else if (entry.timestamp < expireTime) {
        delete cacheData[key];
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      log.debug(`Cleaned up ${deletedCount} expired entries from cache [${this.storageKey}]`);
    }

    cacheData.last_check_date = Date.now();
    await this.save();
  }

  /**
   * Get cached value by ID
   * @param id - Cache entry ID
   * @returns Cached value or null if not found/expired
   */
  async get(id: string | number): Promise<T | null> {
    await this.load();
    if (isNull(this.stats) || isNull((this.stats as Record<string, CacheStorage<T>>)[this.storageKey])) {
      return null;
    }

    const cacheData = (this.stats as Record<string, CacheStorage<T>>)[this.storageKey];
    const entry = cacheData[String(id)] as CacheEntry<T> | undefined;

    if (!entry) return null;

    // Check if expired
    if (this.isExpired(entry)) {
      await this.delete(id);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cached value
   * @param id - Cache entry ID
   * @param value - Value to cache
   */
  async set(id: string | number, value: T): Promise<void> {
    await this.cleanup();
    await this.load();

    const cacheData = (this.stats as Record<string, CacheStorage<T>>)[this.storageKey];

    // Check max size limit
    if (this.maxSize) {
      const currentSize = Object.keys(cacheData).filter(k => k !== "last_check_date").length;
      if (currentSize >= this.maxSize) {
        // Remove oldest entry
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        for (const [key, val] of Object.entries(cacheData)) {
          if (key === "last_check_date") continue;
          const entry = val as CacheEntry<T>;
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp;
            oldestKey = key;
          }
        }

        if (oldestKey) {
          delete cacheData[oldestKey];
          log.debug(`Cache [${this.storageKey}] size limit reached, removed oldest entry:`, oldestKey);
        }
      }
    }

    cacheData[String(id)] = {
      value,
      timestamp: Date.now(),
    };

    log.debug(`Cache [${this.storageKey}] set entry:`, id);
    await this.save();
  }

  /**
   * Delete cached value
   * @param id - Cache entry ID
   */
  async delete(id: string | number): Promise<void> {
    await this.load();
    if (isNull(this.stats) || isNull((this.stats as Record<string, CacheStorage<T>>)[this.storageKey])) {
      return;
    }

    const cacheData = (this.stats as Record<string, CacheStorage<T>>)[this.storageKey];
    delete cacheData[String(id)];
    await this.save();
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    await this.load();
    if (isNull(this.stats)) return;

    (this.stats as Record<string, CacheStorage<T>>)[this.storageKey] = {
      last_check_date: Date.now(),
    };
    await this.save();
  }
}
