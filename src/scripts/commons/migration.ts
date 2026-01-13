/**
 * Migration module for BaekjoonHub v1.x to v2.0.0
 * Handles automatic migration of storage data when users upgrade
 */

import { STORAGE_KEYS } from "@/constants/registry";
import log from "@/commons/logger";
import { getObjectFromLocalStorage, saveObjectInLocalStorage, removeObjectFromLocalStorage } from "./storage";
import { V1_TO_V2_KEY_MAPPING, V2_NEW_KEYS_DEFAULTS, V1_KEYS_TO_DELETE, ORG_OPTION_TEMPLATES } from "./migration-keys";
import type { Stats } from "@/types/storage";

// Migration version constant
const MIGRATION_VERSION_KEY = "baekjoonhub_migration_version";
const CURRENT_MIGRATION_VERSION = "2.0.0";

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  migratedKeys: string[];
  errors: string[];
  skippedKeys: string[];
}

/**
 * Storage backup interface
 */
interface StorageBackup {
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Check if migration should run
 * Migration runs when:
 * 1. Migration version doesn't exist and v1 data exists
 * 2. Migration version is lower than current version
 */
export async function shouldRunMigration(): Promise<boolean> {
  const migrationVersion = await getObjectFromLocalStorage<string>(MIGRATION_VERSION_KEY);

  // If migration version exists and matches current, skip
  if (migrationVersion === CURRENT_MIGRATION_VERSION) {
    log.info("migration.ts: Migration already completed for version", CURRENT_MIGRATION_VERSION);
    return false;
  }

  // Check if any v1 data exists
  const v1TokenExists = await getObjectFromLocalStorage<string>("BaekjoonHub_token");
  const v1HookExists = await getObjectFromLocalStorage<string>("BaekjoonHub_hook");
  const v1StatsExists = await getObjectFromLocalStorage<Stats>("stats");

  const hasV1Data = v1TokenExists !== undefined || v1HookExists !== undefined || v1StatsExists !== undefined;

  if (!hasV1Data) {
    log.info("migration.ts: No v1 data found, skipping migration");
    // Set migration version anyway to prevent future checks
    await saveObjectInLocalStorage({ [MIGRATION_VERSION_KEY]: CURRENT_MIGRATION_VERSION });
    return false;
  }

  log.info("migration.ts: v1 data found, migration needed");
  return true;
}

/**
 * Create backup of all storage data
 */
async function createBackup(): Promise<StorageBackup> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => {
      resolve({
        timestamp: Date.now(),
        data: data,
      });
    });
  });
}

/**
 * Rollback to backup data
 */
async function rollback(backup: StorageBackup): Promise<void> {
  log.warn("migration.ts: Rolling back to backup from", new Date(backup.timestamp).toISOString());

  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      chrome.storage.local.set(backup.data, () => {
        log.info("migration.ts: Rollback completed");
        resolve();
      });
    });
  });
}

/**
 * Convert OrgOption to template settings
 */
function convertOrgOptionToTemplate(orgOption: string): Record<string, unknown> {
  const template = ORG_OPTION_TEMPLATES[orgOption] || ORG_OPTION_TEMPLATES.platform;

  return {
    [STORAGE_KEYS.ORG_OPTION]: orgOption || "platform",
    [STORAGE_KEYS.USE_CUSTOM_TEMPLATE]: false, // Keep using legacy behavior
    [STORAGE_KEYS.DIR_TEMPLATE]: template,
  };
}

/**
 * Transform stats object if needed
 * Ensures all required fields exist
 */
function transformStats(stats: Stats | undefined): Stats {
  if (!stats) {
    return {
      version: CURRENT_MIGRATION_VERSION,
      branches: {},
      submission: {},
      problems: {},
    };
  }

  return {
    version: stats.version || CURRENT_MIGRATION_VERSION,
    branches: stats.branches || {},
    submission: stats.submission || {},
    problems: stats.problems || {},
  };
}

/**
 * Core migration logic: v1.x to v2.0.0
 */
export async function migrateV1ToV2(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedKeys: [],
    errors: [],
    skippedKeys: [],
  };

  try {
    // 1. Read all v1 keys
    const v1Keys = Object.keys(V1_TO_V2_KEY_MAPPING);
    const v1Data = await getObjectFromLocalStorage<Record<string, unknown>>(v1Keys);

    if (!v1Data) {
      log.warn("migration.ts: No v1 data retrieved");
      result.success = true;
      return result;
    }

    log.info("migration.ts: v1 data retrieved:", Object.keys(v1Data));

    // 2. Transform and map to v2 keys
    const v2Data: Record<string, unknown> = {};

    for (const [v1Key, v2Key] of Object.entries(V1_TO_V2_KEY_MAPPING)) {
      const value = v1Data[v1Key];

      if (value !== undefined) {
        // Special handling for stats
        if (v1Key === "stats") {
          v2Data[v2Key] = transformStats(value as Stats);
        } else {
          v2Data[v2Key] = value;
        }
        result.migratedKeys.push(v1Key);
        log.debug(`migration.ts: Mapped ${v1Key} -> ${v2Key}`);
      } else {
        result.skippedKeys.push(v1Key);
      }
    }

    // 3. Handle OrgOption -> Template conversion
    const orgOption = v1Data["BaekjoonHub_OrgOption"] as string | undefined;
    const templateSettings = convertOrgOptionToTemplate(orgOption || "platform");
    Object.assign(v2Data, templateSettings);
    log.info("migration.ts: OrgOption converted to template settings:", templateSettings);

    // 4. Set default values for new v2 keys (only if not already set)
    for (const [key, defaultValue] of Object.entries(V2_NEW_KEYS_DEFAULTS)) {
      if (v2Data[key] === undefined) {
        v2Data[key] = defaultValue;
      }
    }

    // 5. Save v2 data
    await saveObjectInLocalStorage(v2Data);
    log.info("migration.ts: v2 data saved:", Object.keys(v2Data));

    // 6. Delete v1 keys
    await removeObjectFromLocalStorage(V1_KEYS_TO_DELETE);
    log.info("migration.ts: v1 keys deleted:", V1_KEYS_TO_DELETE);

    // 7. Mark migration complete
    await saveObjectInLocalStorage({
      [MIGRATION_VERSION_KEY]: CURRENT_MIGRATION_VERSION,
    });

    result.success = true;
    log.info("migration.ts: Migration completed successfully");
  } catch (error) {
    result.errors.push(String(error));
    log.error("migration.ts: Migration failed:", error);
  }

  return result;
}

/**
 * Validate migration result
 */
async function validateMigration(): Promise<boolean> {
  try {
    // Check if v1 keys are deleted
    for (const v1Key of V1_KEYS_TO_DELETE) {
      const value = await getObjectFromLocalStorage(v1Key);
      if (value !== undefined) {
        log.warn(`migration.ts: v1 key not deleted: ${v1Key}`);
        return false;
      }
    }

    // Check migration version is set
    const migrationVersion = await getObjectFromLocalStorage<string>(MIGRATION_VERSION_KEY);
    if (migrationVersion !== CURRENT_MIGRATION_VERSION) {
      log.warn("migration.ts: Migration version not set correctly");
      return false;
    }

    log.info("migration.ts: Migration validation passed");
    return true;
  } catch (error) {
    log.error("migration.ts: Validation error:", error);
    return false;
  }
}

/**
 * Run migration safely with backup and rollback support
 */
export async function runMigrationSafely(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedKeys: [],
    errors: [],
    skippedKeys: [],
  };

  try {
    // Check if migration is needed
    const shouldMigrate = await shouldRunMigration();

    if (!shouldMigrate) {
      log.info("migration.ts: Migration not needed");
      result.success = true;
      return result;
    }

    log.info("migration.ts: Starting migration...");

    // Create backup before migration
    const backup = await createBackup();
    log.info("migration.ts: Backup created at", new Date(backup.timestamp).toISOString());

    try {
      // Run migration
      const migrationResult = await migrateV1ToV2();

      if (!migrationResult.success) {
        throw new Error(`Migration failed: ${migrationResult.errors.join(", ")}`);
      }

      // Validate migration
      const isValid = await validateMigration();

      if (!isValid) {
        throw new Error("Migration validation failed");
      }

      log.info("migration.ts: Migration completed and validated successfully");
      return migrationResult;
    } catch (migrationError) {
      // Rollback on failure
      log.error("migration.ts: Migration error, rolling back:", migrationError);
      await rollback(backup);
      result.errors.push(String(migrationError));
      return result;
    }
  } catch (error) {
    log.error("migration.ts: Critical error:", error);
    result.errors.push(String(error));
    return result;
  }
}

/**
 * Get current migration version
 */
export async function getMigrationVersion(): Promise<string | undefined> {
  return getObjectFromLocalStorage<string>(MIGRATION_VERSION_KEY);
}

/**
 * Export migration version constant for external use
 */
export const MIGRATION_VERSION = CURRENT_MIGRATION_VERSION;
