import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getIgnorePatterns } from '../utils/gitignore';
import { ApiService } from './api';
import { ConfigService } from './configService';

export class FileSystemService {
  private watcher: chokidar.FSWatcher | null = null;
  private apiService: ApiService;
  private projectRoot: string;
  private isWatching: boolean = false;
  private projectId: string;
  
  constructor(projectRoot: string, apiService: ApiService) {
    this.projectRoot = projectRoot;
    this.apiService = apiService;
    
    // Get project ID from local config
    const configService = new ConfigService(projectRoot);
    const config = configService.getConfig();
    
    if (!config || !config.projectId) {
      throw new Error('Project ID not found in configuration');
    }
    
    this.projectId = config.projectId;
  }
  
  /**
   * Start watching file system changes
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      logger.warn('File watcher is already running');
      return;
    }
    
    const ignorePatterns = await getIgnorePatterns(this.projectRoot);
    
    this.watcher = chokidar.watch(this.projectRoot, {
      ignored: ignorePatterns,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });
    
    this.watcher
      .on('add', this.handleFileAdded.bind(this))
      .on('change', this.handleFileChanged.bind(this))
      .on('unlink', this.handleFileDeleted.bind(this));
      
    this.isWatching = true;
    logger.info(`Started watching ${this.projectRoot}`);
  }
  
  /**
   * Stop watching file system changes
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      logger.warn('File watcher is not running');
      return;
    }
    
    await this.watcher.close();
    this.watcher = null;
    this.isWatching = false;
    
    logger.info('Stopped watching file system changes');
  }
  
  /**
   * Handle file added event
   * @param filePath File path
   */
  private async handleFileAdded(filePath: string): Promise<void> {
    try {
      const relativePath = path.relative(this.projectRoot, filePath);
      logger.debug(`File added: ${relativePath}`);
      
      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Send to API
      await this.apiService.updateFile(this.projectId, relativePath, content);
      
      logger.info(`Processed new file: ${relativePath}`);
    } catch (error) {
      logger.error(`Failed to process added file ${filePath}:`, error);
    }
  }
  
  /**
   * Handle file changed event
   * @param filePath File path
   */
  private async handleFileChanged(filePath: string): Promise<void> {
    try {
      const relativePath = path.relative(this.projectRoot, filePath);
      logger.debug(`File changed: ${relativePath}`);
      
      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Send to API
      await this.apiService.updateFile(this.projectId, relativePath, content);
      
      logger.info(`Processed file change: ${relativePath}`);
    } catch (error) {
      logger.error(`Failed to process changed file ${filePath}:`, error);
    }
  }
  
  /**
   * Handle file deleted event
   * @param filePath File path
   */
  private async handleFileDeleted(filePath: string): Promise<void> {
    try {
      const relativePath = path.relative(this.projectRoot, filePath);
      logger.debug(`File deleted: ${relativePath}`);
      
      // Notify API
      await this.apiService.deleteFile(this.projectId, relativePath);
      
      logger.info(`Processed file deletion: ${relativePath}`);
    } catch (error) {
      logger.error(`Failed to process deleted file ${filePath}:`, error);
    }
  }
}
