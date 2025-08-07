/**
 * Storage Batcher for optimizing Chrome storage operations
 * Reduces I/O operations by batching multiple updates
 */
import { getStats, saveStats } from "@/commons/storage.js";
import log from "@/commons/logger.js";
import { TIMEOUTS } from "@/constants/config.js";

/**
 * Utility to update nested object from path
 * @param {Object} obj - Target object
 * @param {string} path - Path like "folder/file.js"
 * @param {any} value - Value to set
 */
function updateObjectFromPath(obj, path, value) {
  const parts = path.split("/");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Storage Batcher class for optimizing storage operations
 */
export class StorageBatcher {
  constructor() {
    this.pendingUpdates = new Map();
    this.flushTimer = null;
    this.flushDelay = TIMEOUTS.STORAGE_BATCH_FLUSH;
    this.isProcessing = false;
  }

  /**
   * Schedule a SHA update to be batched
   * @param {string} path - File path
   * @param {string} sha - SHA value
   */
  scheduleSHAUpdate(path, sha) {
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
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   */
  scheduleUpdate(key, value) {
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
  scheduleFlush() {
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
   * @returns {Promise<void>}
   */
  async flush() {
    // Check if there are pending updates
    if (this.pendingUpdates.size === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.flushTimer = null;

    try {
      log.debug(`Flushing ${this.pendingUpdates.size} batched storage updates`);

      // Group updates by type
      const shaUpdates = new Map();
      const genericUpdates = new Map();

      for (const [key, update] of this.pendingUpdates) {
        if (update.type === "sha") {
          shaUpdates.set(key, update.value);
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
   * @param {Map} shaUpdates - Map of path to SHA
   * @returns {Promise<void>}
   */
  async processSHAUpdates(shaUpdates) {
    try {
      const stats = await getStats();

      // Ensure submission object exists
      if (!stats.submission) {
        stats.submission = {};
      }

      // Apply all SHA updates
      for (const [path, sha] of shaUpdates) {
        updateObjectFromPath(stats.submission, path, sha);
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
   * @param {Map} genericUpdates - Map of key to value
   * @returns {Promise<void>}
   */
  async processGenericUpdates(genericUpdates) {
    try {
      // Convert Map to object for Chrome storage
      const updates = {};
      for (const [key, value] of genericUpdates) {
        updates[key] = value;
      }

      // Use Chrome storage set for batch update
      await new Promise((resolve, reject) => {
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
   * @returns {Promise<void>}
   */
  async forceFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    return this.flush();
  }

  /**
   * Get number of pending updates
   * @returns {number}
   */
  getPendingCount() {
    return this.pendingUpdates.size;
  }

  /**
   * Clear all pending updates without flushing
   */
  clear() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingUpdates.clear();
    log.debug("Cleared all pending storage updates");
  }
}

// Export singleton instance
export default new StorageBatcher();
