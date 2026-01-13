/**
 * Logger module for BaekjoonHub
 * Uses loglevel with prefix plugin for consistent logging format
 */

import log, { Logger } from "loglevel";
import prefix from "loglevel-plugin-prefix";

// Register prefix plugin
prefix.reg(log);

// Enable all log levels by default
log.enableAll();

// Apply prefix format
prefix.apply(log, {
  format(level: string, name: string | undefined, timestamp: Date): string {
    return `[백준허브]${name != null && name !== "root" ? `[${name}]` : ""}:`;
  },
});

// Export the configured logger
export default log;

// Export type for logger
export type { Logger };
