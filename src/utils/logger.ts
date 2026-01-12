/**
 * Debug logger for Classpresso
 * Generates detailed log files for troubleshooting
 */

import { appendFile, writeFile } from 'fs/promises';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import type { ClasspressoConfig } from '../types/index.js';

const require = createRequire(import.meta.url);

const DEBUG_LOG_FILENAME = 'classpresso-debug.log';

export interface LoggerOptions {
  debug: boolean;
  verbose: boolean;
  buildDir: string;
}

export interface Logger {
  /** Log info message to console (always shown) */
  info(message: string): void;
  /** Log warning message to console (always shown) */
  warn(message: string): void;
  /** Log error message to console (always shown) */
  error(message: string): void;
  /** Log verbose message to console (only when verbose flag is set) */
  verbose(message: string): void;

  /** Log system info to debug file */
  logSystemInfo(): Promise<void>;
  /** Log config resolution to debug file */
  logConfig(config: ClasspressoConfig, source: string): Promise<void>;
  /** Log operation step to debug file */
  logStep(step: string, details?: Record<string, unknown>): Promise<void>;
  /** Log timing for an operation to debug file */
  logTiming(operation: string, durationMs: number): Promise<void>;
  /** Log error details to debug file */
  logError(error: Error, context?: string): Promise<void>;

  /** Flush and close the log file */
  close(): Promise<void>;

  /** Get the log file path */
  getLogPath(): string | null;
}

/**
 * Get classpresso version from package.json
 */
export function getVersion(): string {
  try {
    // Use fileURLToPath for cross-platform compatibility (Windows/POSIX)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJson = require(packageJsonPath);
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Create a logger instance
 */
export function createLogger(options: LoggerOptions): Logger {
  const { debug, verbose, buildDir } = options;
  const logPath = debug ? path.join(buildDir, DEBUG_LOG_FILENAME) : null;
  let initialized = false;

  /**
   * Write to the debug log file
   */
  async function writeToLog(content: string): Promise<void> {
    if (!logPath) return;

    try {
      if (!initialized) {
        // Initialize log file with header
        const header = `=== CLASSPRESSO DEBUG LOG ===\nGenerated: ${new Date().toISOString()}\n\n`;
        await writeFile(logPath, header, 'utf-8');
        initialized = true;
      }
      await appendFile(logPath, content + '\n', 'utf-8');
    } catch (err) {
      // Silently fail - don't let logging errors affect the main process
      console.error(`Warning: Failed to write to debug log: ${err}`);
    }
  }

  /**
   * Format a timestamp for log entries
   */
  function timestamp(): string {
    return `[${new Date().toISOString()}]`;
  }

  return {
    info(message: string): void {
      console.log(message);
    },

    warn(message: string): void {
      console.warn(message);
    },

    error(message: string): void {
      console.error(message);
    },

    verbose(message: string): void {
      if (verbose) {
        console.log(message);
      }
    },

    async logSystemInfo(): Promise<void> {
      if (!debug) return;

      const systemInfo = [
        '=== SYSTEM INFO ===',
        `Classpresso Version: ${getVersion()}`,
        `Node Version: ${process.version}`,
        `OS: ${process.platform}`,
        `OS Release: ${os.release()}`,
        `Architecture: ${process.arch}`,
        `CWD: ${process.cwd()}`,
        '',
      ].join('\n');

      await writeToLog(systemInfo);
    },

    async logConfig(config: ClasspressoConfig, source: string): Promise<void> {
      if (!debug) return;

      // Create a sanitized version of config for logging
      const sanitizedConfig = {
        buildDir: path.basename(config.buildDir),
        minOccurrences: config.minOccurrences,
        minClasses: config.minClasses,
        minBytesSaved: config.minBytesSaved,
        hashPrefix: config.hashPrefix,
        hashLength: config.hashLength,
        cssLayer: config.cssLayer,
        dataAttributes: config.dataAttributes,
        manifest: config.manifest,
        backup: config.backup,
        verbose: config.verbose,
        forceAll: config.forceAll,
        excludeDynamicPatterns: config.excludeDynamicPatterns,
        skipPatternsWithExcludedClasses: config.skipPatternsWithExcludedClasses,
        ssr: config.ssr,
        debug: config.debug,
        sendErrorReports: config.sendErrorReports,
        // Exclude errorReportUrl, exclude patterns, and include patterns for privacy
        excludePrefixCount: config.exclude.prefixes?.length || 0,
        excludeSuffixCount: config.exclude.suffixes?.length || 0,
        excludeClassCount: config.exclude.classes?.length || 0,
        excludePatternCount: config.exclude.patterns?.length || 0,
        excludeFileCount: config.exclude.files?.length || 0,
        dynamicPrefixCount: config.dynamicPrefixes?.length || 0,
        includePatternCount: config.include?.length || 0,
      };

      const configInfo = [
        '=== CONFIG ===',
        `Source: ${source}`,
        'Final Config:',
        JSON.stringify(sanitizedConfig, null, 2),
        '',
      ].join('\n');

      await writeToLog(configInfo);
    },

    async logStep(step: string, details?: Record<string, unknown>): Promise<void> {
      if (!debug) return;

      let entry = `${timestamp()} ${step}`;
      if (details) {
        const detailLines = Object.entries(details)
          .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
          .join('\n');
        entry += '\n' + detailLines;
      }

      await writeToLog(entry);
    },

    async logTiming(operation: string, durationMs: number): Promise<void> {
      if (!debug) return;

      await writeToLog(`${timestamp()} ${operation} completed in ${durationMs}ms`);
    },

    async logError(error: Error, context?: string): Promise<void> {
      if (!debug) return;

      const errorInfo = [
        '',
        '=== ERROR ===',
        `${timestamp()} ${context || 'Error occurred'}`,
        `Message: ${error.message}`,
        `Stack trace:`,
        error.stack || 'No stack trace available',
        '',
      ].join('\n');

      await writeToLog(errorInfo);
    },

    async close(): Promise<void> {
      if (!debug || !logPath) return;

      await writeToLog(`\n=== LOG COMPLETE ===\nEnded: ${new Date().toISOString()}\n`);
    },

    getLogPath(): string | null {
      return logPath;
    },
  };
}
