import { Logger, type ILogObj } from 'tslog';

/**
 * Log levels available for configuration.
 * These map to tslog's log levels:
 * - TRACE = 1 (tslog's trace)
 * - DEBUG = 2 (tslog's debug)
 * - INFO = 3 (tslog's info)
 * - WARN = 4 (tslog's warn)
 * - ERROR = 5 (tslog's error)
 * - FATAL = 6 (tslog's fatal)
 * - SILENT = 99 (disable all logging, not a tslog level)
 */
export enum LogLevel {
  /** Very detailed debugging information (maps to tslog's trace level 1) */
  TRACE = 1,
  /** Detailed debugging information (maps to tslog's debug level 2) */
  DEBUG = 2,
  /** General informational messages (maps to tslog's info level 3) */
  INFO = 3,
  /** Warning messages (maps to tslog's warn level 4) */
  WARN = 4,
  /** Error messages (maps to tslog's error level 5) */
  ERROR = 5,
  /** Fatal error messages (maps to tslog's fatal level 6) */
  FATAL = 6,
  /** Disable all logging (uses 99, not a tslog level) */
  SILENT = 99,
}

/**
 * Module names for granular logging control.
 */
export type LoggerModule = 'socket' | 'messenger' | 'pubsub' | 'default';

/**
 * Map of module names to their logger instances.
 */
const moduleLoggers = new Map<LoggerModule, Logger<ILogObj>>();

/**
 * Creates a base logger with the specified min level.
 * @param minLevel - The minimum log level to display.
 * @returns A base logger instance.
 */
function createBaseLogger(minLevel: number): Logger<ILogObj> {
  return new Logger<ILogObj>({
    minLevel,
    type: 'pretty',
    hideLogPositionForProduction: true,
    prettyLogTemplate: '{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t[{{logLevelName}}]\t{{name}}\t',
  });
}

// Use a mutable variable so we can recreate the base logger when settings change
let baseLogger = createBaseLogger(LogLevel.INFO);

/**
 * Gets or creates a logger instance for a specific module.
 * @param module - The module name.
 * @returns A logger instance configured for the module.
 */
export function getLogger(module: LoggerModule = 'default'): Logger<ILogObj> {
  let logger = moduleLoggers.get(module);
  if (!logger) {
    logger = baseLogger.getSubLogger({
      name: module.toUpperCase(),
    });
    moduleLoggers.set(module, logger);
  }
  return logger;
}

/**
 * Sets the log level for all loggers.
 * @param level - The log level to set.
 */
export function setLogLevel(level: LogLevel): void {
  // LogLevel enum values already match tslog's numeric levels (except SILENT)
  const numericLevel = level === LogLevel.SILENT ? 99 : level;
  // Recreate base logger with new level
  baseLogger = createBaseLogger(numericLevel);
  // Recreate all module loggers to inherit new settings
  moduleLoggers.forEach((logger, module) => {
    const newLogger = baseLogger.getSubLogger({
      name: module.toUpperCase(),
    });
    moduleLoggers.set(module, newLogger);
  });
}

/**
 * Sets the log level for a specific module.
 * @param module - The module name.
 * @param level - The log level to set.
 */
export function setModuleLogLevel(module: LoggerModule, level: LogLevel): void {
  // LogLevel enum values already match tslog's numeric levels (except SILENT)
  const numericLevel = level === LogLevel.SILENT ? 99 : level;
  // Create a new sub-logger with the specific level
  const newLogger = baseLogger.getSubLogger({
    name: module.toUpperCase(),
    minLevel: numericLevel,
  });
  moduleLoggers.set(module, newLogger);
}

/**
 * Gets the current log level for a specific module.
 * @param module - The module name.
 * @returns The current log level.
 */
export function getModuleLogLevel(module: LoggerModule = 'default'): LogLevel {
  const logger = getLogger(module);
  const minLevel = logger.settings.minLevel;
  // Map tslog's numeric levels to our LogLevel enum
  // tslog: 0=silly, 1=trace, 2=debug, 3=info, 4=warn, 5=error, 6=fatal
  // Our enum: TRACE=1, DEBUG=2, INFO=3, WARN=4, ERROR=5, FATAL=6, SILENT=99
  if (minLevel >= 99) return LogLevel.SILENT;
  if (minLevel >= 6) return LogLevel.FATAL;
  if (minLevel >= 5) return LogLevel.ERROR;
  if (minLevel >= 4) return LogLevel.WARN;
  if (minLevel >= 3) return LogLevel.INFO;
  if (minLevel >= 2) return LogLevel.DEBUG;
  if (minLevel >= 1) return LogLevel.TRACE;
  // minLevel 0 is tslog's "silly" level, map to TRACE
  return LogLevel.TRACE;
}

/**
 * Creates a proxy logger that always returns the current logger instance from the map.
 * This ensures exported loggers update when setLogLevel() or setModuleLogLevel() is called.
 * @param module - The module name.
 * @returns A logger instance.
 */
function createLoggerProxy(module: LoggerModule): Logger<ILogObj> {
  return new Proxy({} as Logger<ILogObj>, {
    get(_target, prop: keyof Logger<ILogObj>) {
      const logger = getLogger(module);
      const value = logger[prop];
      // Bind methods to the actual logger instance to preserve 'this' context
      if (typeof value === 'function') {
        return value.bind(logger);
      }
      return value;
    },
  });
}

// Export convenience loggers for each module
// These proxies ensure they always reference the current logger instance
export const socketLogger = createLoggerProxy('socket');
export const messengerLogger = createLoggerProxy('messenger');
export const pubsubLogger = createLoggerProxy('pubsub');
export const defaultLogger = createLoggerProxy('default');
