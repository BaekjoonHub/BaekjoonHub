/**
 * Storage Batcher for optimizing Chrome storage operations
 * Reduces I/O operations by batching multiple updates
 */
import { getStats, saveStats } from "@/commons/storage";
import log from "@/commons/logger";
import { TIMEOUTS } from "@/constants/config";
import type { Stats } from "@/types/storage";

// Update type for batched operations
interface BatchedUpdate {
  type: "sha" | "generic";
  value: unknown;
  timestamp: number;
}

type NestedObject = Record<string, unknown>;

/**
 * Utility to update nested object from path
 * @param obj - Target object
 * @param path - Path like "folder/file.js"
 * @param value - Value to set
 */
function updateObjectFromPath(obj: NestedObject, path: string, value: unknown): void {
  const parts = path.split("/");
  let current: NestedObject = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part] as NestedObject;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Storage Batcher class for optimizing storage operations
 */
export class StorageBatcher {
  private pendingUpdates: Map<string, BatchedUpdate> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushDelay: number;
  private isProcessing = false;

  constructor() {
    this.flushDelay = TIMEOUTS.STORAGE_BATCH_FLUSH;
  }

  /**
   * Schedule a SHA update to be batched
   * @param path - File path
   * @param sha - SHA value
   */
  scheduleSHAUpdate(path: string, sha: string): void {
    if (!path || !sha) {
      log.warn("Invalid SHA update scheduled:", { path, sha });
      return;
    }

    this.pendingUpdates.set(path, {
      type: "sha",
      value: sha,
      timestamp: Date.now(),
    });

    this.scheduleFlush();
  }

  /**
   * Schedule a generic update to be batched
   * @param key - Storage key
   * @param value - Value to store
   */
  scheduleUpdate(key: string, value: unknown): void {
    this.pendingUpdates.set(key, {
      type: "generic",
      value,
      timestamp: Date.now(),
    });

    this.scheduleFlush();
  }

  /**
   * Schedule flush operation
   */
  private scheduleFlush(): void {
    // Don't schedule if already processing
    if (this.isProcessing) {
      return;
    }

    // Clear existing timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    // Schedule new flush
    this.flushTimer = setTimeout(() => this.flush(), this.flushDelay);
  }

  /**
   * Flush all pending updates to storage
   */
  async flush(): Promise<void> {
    // Check if there are pending updates
    if (this.pendingUpdates.size === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.flushTimer = null;

    try {
      log.debug(`Flushing ${this.pendingUpdates.size} batched storage updates`);

      // Group updates by type
      const shaUpdates = new Map<string, string>();
      const genericUpdates = new Map<string, unknown>();

      for (const [key, update] of this.pendingUpdates) {
        if (update.type === "sha") {
          shaUpdates.set(key, update.value as string);
        } else {
          genericUpdates.set(key, update.value);
        }
      }

      // Process SHA updates in batch
      if (shaUpdates.size > 0) {
        await this.processSHAUpdates(shaUpdates);
      }

      // Process generic updates
      if (genericUpdates.size > 0) {
        await this.processGenericUpdates(genericUpdates);
      }

      // Clear pending updates
      this.pendingUpdates.clear();

      log.debug("Storage batch flush completed successfully");
    } catch (error) {
      log.error("Error during storage batch flush:", error);
      // Don't clear updates on error, they'll be retried
    } finally {
      this.isProcessing = false;

      // If new updates were added during processing, schedule another flush
      if (this.pendingUpdates.size > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Process SHA updates in batch
   * @param shaUpdates - Map of path to SHA
   */
  private async processSHAUpdates(shaUpdates: Map<string, string>): Promise<void> {
    try {
      const stats = await getStats();

      // Ensure submission object exists
      if (!stats.submission) {
        stats.submission = {};
      }

      // Apply all SHA updates
      for (const [path, sha] of shaUpdates) {
        updateObjectFromPath(stats.submission as NestedObject, path, sha);
      }

      // Save once
      await saveStats(stats);

      log.debug(`Batch updated ${shaUpdates.size} SHA values`);
    } catch (error) {
      log.error("Error processing SHA updates:", error);
      throw error;
    }
  }

  /**
   * Process generic storage updates
   * @param genericUpdates - Map of key to value
   */
  private async processGenericUpdates(genericUpdates: Map<string, unknown>): Promise<void> {
    try {
      // Convert Map to object for Chrome storage
      const updates: Record<string, unknown> = {};
      for (const [key, value] of genericUpdates) {
        updates[key] = value;
      }

      // Use Chrome storage set for batch update
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set(updates, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      log.debug(`Batch updated ${genericUpdates.size} generic values`);
    } catch (error) {
      log.error("Error processing generic updates:", error);
      throw error;
    }
  }

  /**
   * Force immediate flush (useful for critical updates)
   */
  async forceFlush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    return this.flush();
  }

  /**
   * Get number of pending updates
   */
  getPendingCount(): number {
    return this.pendingUpdates.size;
  }

  /**
   * Clear all pending updates without flushing
   */
  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingUpdates.clear();
    log.debug("Cleared all pending storage updates");
  }
}

// Export singleton instance
const storageBatcher = new StorageBatcher();
export default storageBatcher;
