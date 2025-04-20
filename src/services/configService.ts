import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';

export class ConfigService {
  private configPath: string;
  private config: Record<string, any> | null = null;

  constructor(projectRoot: string = os.homedir()) {
    this.configPath = path.join(projectRoot, '.carver', 'config.json');
  }

  /**
   * Load configuration from file
   * Creates default config if not exists
   */
  async load(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        // Load existing configuration
        this.config = await fs.readJSON(this.configPath);
        logger.debug('Configuration loaded from', this.configPath);
      } else {
        // Create default configuration
        this.config = {
          apiUrl: 'https://api.carver.dev',
        };

        await fs.ensureDir(path.dirname(this.configPath));
        await fs.writeJSON(this.configPath, this.config, { spaces: 2 });
        logger.debug('Default configuration created at', this.configPath);
      }
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Get configuration value by key
   * @param key Configuration key
   * @returns Configuration value or undefined if not found
   */
  get(key: string): any {
    if (!this.config) {
      logger.warn('Attempted to get config value before loading');
      return undefined;
    }
    return this.config[key];
  }

  /**
   * Set configuration value
   * @param key Configuration key
   * @param value Configuration value
   */
  async set(key: string, value: any): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    this.config[key] = value;
    await this.save();
    logger.debug(`Configuration updated: ${key}=${value}`);
  }

  /**
   * Save configuration to file
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJSON(this.configPath, this.config, { spaces: 2 });
      logger.debug('Configuration saved to', this.configPath);
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw error;
    }
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
   * Get the configuration file path
   * @param customDir Optional custom directory
   * @returns Path to configuration file
   */
  getConfigPath(customDir?: string): string {
    if (customDir) {
      return path.join(customDir, '.carver', 'config.json');
    }
    return this.configPath;
  }

  /**
   * Check if project is initialized
   * @returns True if project is initialized
   */
  isInitialized(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Update multiple configuration values at once
   * @param updateValues Object with new configuration values
   */
  async updateConfig(updateValues: Record<string, any>): Promise<Record<string, any>> {
    if (!this.config) {
      await this.load();
    }

    this.config = {
      ...this.config,
      ...updateValues,
    };

    await this.save();
    return this.config || {};
  }
}
