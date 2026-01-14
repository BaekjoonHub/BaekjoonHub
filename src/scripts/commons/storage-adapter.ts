/**
 * Chrome Storage Adapter
 * Pure Chrome API wrapper without business logic
 * Provides a clean interface for storage operations
 */
import log from "@/commons/logger";

/**
 * Storage adapter interface
 * Defines contract for storage operations
 */
export interface IStorageAdapter {
  get<T>(key: string | string[], area: "local" | "sync"): Promise<T | undefined>;
  set(obj: Record<string, unknown>, area: "local" | "sync"): Promise<void>;
  remove(keys: string | string[], area: "local" | "sync"): Promise<void>;
}

/**
 * Chrome Storage Adapter
 * Implements storage operations using Chrome Storage API
 */
export class ChromeStorageAdapter implements IStorageAdapter {
  /**
   * Get value from storage
   * @param key - Storage key or array of keys
   * @param area - Storage area (local or sync)
   * @returns Stored value or undefined
   */
  async get<T>(key: string | string[], area: "local" | "sync"): Promise<T | undefined> {
    log.debug(`ChromeStorageAdapter: Getting key(s) ${key} from ${area} storage`);

    return new Promise((resolve) => {
      try {
        chrome.storage[area].get(key, (value: Record<string, unknown>) => {
          if (Array.isArray(key)) {
            log.debug("ChromeStorageAdapter: Retrieved multiple keys:", value);
            resolve(value as T);
          } else {
            log.debug(`ChromeStorageAdapter: Retrieved key ${key}:`, value[key]);
            resolve(value[key] as T);
          }
        });
      } catch (ex) {
        log.error(`ChromeStorageAdapter: Error getting key(s) ${key}:`, ex);
        resolve(undefined);
      }
    });
  }

  /**
   * Set value in storage
   * @param obj - Object to save
   * @param area - Storage area (local or sync)
   */
  async set(obj: Record<string, unknown>, area: "local" | "sync"): Promise<void> {
    log.debug(`ChromeStorageAdapter: Setting object in ${area} storage:`, obj);

    return new Promise((resolve) => {
      try {
        chrome.storage[area].set(obj, () => {
          log.debug("ChromeStorageAdapter: Set operation completed");
          resolve();
        });
      } catch (ex) {
        log.error("ChromeStorageAdapter: Error setting object:", ex);
        resolve();
      }
    });
  }

  /**
   * Remove value from storage
   * @param keys - Key or array of keys to remove
   * @param area - Storage area (local or sync)
   */
  async remove(keys: string | string[], area: "local" | "sync"): Promise<void> {
    log.debug(`ChromeStorageAdapter: Removing key(s) ${keys} from ${area} storage`);

    return new Promise((resolve) => {
      try {
        chrome.storage[area].remove(keys, () => {
          log.debug("ChromeStorageAdapter: Remove operation completed");
          resolve();
        });
      } catch (ex) {
        log.error(`ChromeStorageAdapter: Error removing key(s) ${keys}:`, ex);
        resolve();
      }
    });
  }
}

// Create singleton instance
export const chromeStorageAdapter = new ChromeStorageAdapter();
