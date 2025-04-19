import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Default configuration
const defaultConfig = {
  version: '1.0.0',
  apiEndpoint: 'https://api.carver.ai',
  timeout: 30000
};

// Global config
let globalConfig: any = { ...defaultConfig };

/**
 * Load global configuration
 */
export function loadConfig(): void {
  try {
    // Try to load config from home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const configPath = path.join(homeDir!, '.carver', 'config.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configData);
      
      // Merge with default config
      globalConfig = {
        ...defaultConfig,
        ...userConfig
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
 */
export function getConfig(): any {
  return globalConfig;
}

/**
 * Update global configuration
 */
export function updateConfig(newConfig: any): void {
  globalConfig = {
    ...globalConfig,
    ...newConfig
  };
  
  // Save to disk
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configDir = path.join(homeDir!, '.carver');
  const configPath = path.join(configDir, 'config.json');
  
  try {
    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write config file
    fs.writeFileSync(configPath, JSON.stringify(globalConfig, null, 2));
    logger.debug('Saved global configuration');
  } catch (error) {
    logger.error('Failed to save global configuration', error);
  }
}
