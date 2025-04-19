import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Default log level
const logLevel = 'info';

// Create a logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    }),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => {
          return `${level}: ${message}`;
        }),
      ),
    }),
  ],
});

/**
 * Initialize logger with appropriate configuration
 * @param options Logger options
 */
export function initializeLogger(options?: {
  quiet?: boolean;
  verbose?: boolean;
  logFile?: string;
}): void {
  // Set log level based on options
  if (options?.quiet) {
    logger.level = 'error';
  } else if (options?.verbose) {
    logger.level = 'debug';
  } else if (process.env.LOG_LEVEL) {
    logger.level = process.env.LOG_LEVEL;
  }

  // Set log level based on environment if not explicitly set
  if (!options?.quiet && !options?.verbose && !process.env.LOG_LEVEL) {
    if (process.env.NODE_ENV === 'development') {
      logger.level = 'debug';
    } else {
      logger.level = 'info';
    }
  }

  // Add file transport if specified
  const logFile = options?.logFile || process.env.LOG_FILE;
  if (logFile) {
    // Ensure directory exists
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    logger.add(
      new winston.transports.File({
        filename: logFile,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.uncolorize(),
          winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} ${level}: ${message}`;
          }),
        ),
      }),
    );
  }

  logger.debug('Logger initialized');
}

/**
 * Get current log level
 * @returns Current log level
 */
export function getLogLevel(): string {
  return logger.level;
}

/**
 * Set log level
 * @param level New log level
 */
export function setLogLevel(level: string): void {
  logger.level = level;
}
