import * as winston from 'winston';

// Create a logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export function initializeLogger(): void {
  // Set log level based on environment
  if (process.env.NODE_ENV === 'development') {
    logger.level = 'debug';
  }
  
  // Add additional transports if needed
  if (process.env.LOG_FILE) {
    logger.add(new winston.transports.File({ 
      filename: process.env.LOG_FILE 
    }));
  }
  
  logger.debug('Logger initialized');
}
