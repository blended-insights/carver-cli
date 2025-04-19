import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Default configuration
const defaultConfig = {
  version: '1.0.0',
  apiEndpoint: 'https://api.carver.ai',
  timeout: 30000,
  maxWatchPaths: 1000,
  ignorePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '**/*.log', '.carver/**'],
};

// Global config
let globalConfig: any = { ...defaultConfig };

/**
 * Load global configuration
 * @param customConfigPath Optional path to custom config file
 */
export function loadConfig(customConfigPath?: string): void {
  try {
    let configPath: string;

    if (customConfigPath) {
      // Use custom config path if provided
      configPath = path.resolve(customConfigPath);
      logger.debug(`Using custom config path: ${configPath}`);
    } else {
      // Use default config path in home directory
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      configPath = path.join(homeDir!, '.carver', 'config.json');
      logger.debug(`Using default config path: ${configPath}`);
    }

    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configData);

      // Merge with default config
      globalConfig = {
        ...defaultConfig,
        ...userConfig,
      };

      logger.debug('Loaded global configuration');
    } else {
      logger.debug('No global configuration found, using defaults');
    }
  } catch (error) {
    logger.warn('Failed to load global configuration, using defaults', error);
  }
}

/**
 * Get global configuration
 * @returns Global configuration object
 */
export function getConfig(): any {
  return globalConfig;
}

/**
 * Update global configuration
 * @param newConfig New configuration values
 * @param customConfigPath Optional path to custom config file
 */
export function updateConfig(newConfig: any, customConfigPath?: string): void {
  globalConfig = {
    ...globalConfig,
    ...newConfig,
  };

  // Determine where to save config
  let configPath: string;
  if (customConfigPath) {
    configPath = path.resolve(customConfigPath);
  } else {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const configDir = path.join(homeDir!, '.carver');
    configPath = path.join(configDir, 'config.json');

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  try {
    // Write config file
    fs.writeFileSync(configPath, JSON.stringify(globalConfig, null, 2));
    logger.debug(`Saved global configuration to ${configPath}`);
  } catch (error) {
    logger.error('Failed to save global configuration', error);
  }
}

/**
 * Reset configuration to defaults
 * @returns Default configuration
 */
export function resetConfig(): any {
  globalConfig = { ...defaultConfig };
  return globalConfig;
}

/**
 * Get a specific configuration value
 * @param key Configuration key
 * @param defaultValue Default value if key not found
 * @returns Configuration value or default
 */
export function getConfigValue<T>(key: string, defaultValue?: T): T {
  const value = key.split('.').reduce((obj, k) => obj && obj[k], globalConfig as any);
  return value !== undefined ? value : (defaultValue as T);
}
