import winston from 'winston';
import { logger, initializeLogger } from '../../../src/utils/logger';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    level: 'info',
    add: jest.fn(),
    debug: jest.fn(),
  }),
  format: {
    timestamp: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
    combine: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logger instance', () => {
    it('should be created with winston createLogger', () => {
      expect(winston.createLogger).toHaveBeenCalled();
    });
  });

  describe('initializeLogger', () => {
    it('should set debug level in development environment', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      initializeLogger();

      expect(logger.level).toBe('debug');

      // Restore original environment
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should add file transport when LOG_FILE is set', () => {
      const originalLogFile = process.env.LOG_FILE;
      process.env.LOG_FILE = 'test.log';

      initializeLogger();

      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: 'test.log',
      });
      expect(logger.add).toHaveBeenCalled();

      // Restore original environment
      process.env.LOG_FILE = originalLogFile;
    });

    it('should not add file transport when LOG_FILE is not set', () => {
      const originalLogFile = process.env.LOG_FILE;
      delete process.env.LOG_FILE;

      initializeLogger();

      expect(winston.transports.File).not.toHaveBeenCalled();

      // Restore original environment
      process.env.LOG_FILE = originalLogFile;
    });
  });
});
