import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export class ConfigService {
  private projectRoot: string;
  private configPath: string;
  
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.configPath = path.join(projectRoot, '.carver', 'config.json');
  }
  
  /**
   * Get project configuration
   * @returns Project configuration or null if not found
   */
  getConfig(): any | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        logger.debug('Project configuration not found');
        return null;
      }
      
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      logger.error('Failed to read project configuration:', error);
      return null;
    }
  }
  
  /**
   * Save project configuration
   * @param config Configuration to save
   */
  saveConfig(config: any): void {
    try {
      // Ensure .carver directory exists
      const configDir = path.dirname(this.configPath);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Write configuration file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      logger.debug('Project configuration saved');
    } catch (error) {
      logger.error('Failed to save project configuration:', error);
    }
  }
  
  /**
   * Check if project is initialized
   * @returns True if project is initialized
   */
  isInitialized(): boolean {
    return fs.existsSync(this.configPath);
  }
  
  /**
   * Update project configuration
   * @param config New configuration values
   * @returns Updated configuration
   */
  updateConfig(config: any): any {
    const currentConfig = this.getConfig() || {};
    const updatedConfig = {
      ...currentConfig,
      ...config
    };
    
    this.saveConfig(updatedConfig);
    return updatedConfig;
  }
}
