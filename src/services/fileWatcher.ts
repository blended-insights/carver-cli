import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { EventEmitter } from 'events';

export interface FileChange {
  path: string;
  type: 'add' | 'change' | 'unlink';
  content?: string;
}

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private projectRoot: string;
  private isWatching: boolean = false;
  private ignorePatterns: string[] = [];
  private queue: Map<string, FileChange> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceDelay: number = 500; // ms
  
  /**
   * Create a new file watcher
   * @param projectRoot Root directory of the project to watch
   */
  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
    
    // Get ignore patterns from config
    const config = getConfig();
    this.ignorePatterns = config.ignorePatterns || [];
    
    // Load project-specific ignore patterns
    this.loadGitignore();
    this.loadCarverignore();
  }
  
  /**
   * Start watching for file changes
   * @returns Promise that resolves when watcher is ready
   */
  start(): Promise<void> {
    if (this.isWatching) {
      logger.warn('File watcher already started');
      return Promise.resolve();
    }
    
    logger.info(`Starting file watcher in ${this.projectRoot}`);
    logger.debug(`Ignoring patterns: ${this.ignorePatterns.join(', ')}`);
    
    // Initialize chokidar watcher
    this.watcher = chokidar.watch(this.projectRoot, {
      ignoreInitial: true,
      ignored: this.ignorePatterns,
      persistent: true,
      ignorePermissionErrors: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });
    
    // Set up event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'add'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'change'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'unlink'))
      .on('error', (error) => {
        logger.error('File watcher error:', error);
        this.emit('error', error);
      });
    
    // Return a promise that resolves when the watcher is ready
    return new Promise((resolve) => {
      if (!this.watcher) {
        resolve();
        return;
      }
      
      this.watcher.on('ready', () => {
        this.isWatching = true;
        logger.info('File watcher ready');
        this.emit('ready');
        resolve();
      });
    });
  }
  
  /**
   * Stop watching for file changes
   * @returns Promise that resolves when watcher is closed
   */
  stop(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      logger.debug('File watcher not running');
      return Promise.resolve();
    }
    
    logger.info('Stopping file watcher');
    
    // Clear any pending debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Process any remaining queued changes
    this.processQueue();
    
    // Close the watcher
    return this.watcher.close().then(() => {
      this.isWatching = false;
      this.watcher = null;
      logger.info('File watcher stopped');
      this.emit('stop');
    });
  }
  
  /**
   * Handle file change event
   * @param filePath Path to changed file
   * @param type Type of change
   */
  private handleFileChange(filePath: string, type: 'add' | 'change' | 'unlink'): void {
    // Convert to relative path
    const relativePath = path.relative(this.projectRoot, filePath);
    
    logger.debug(`File ${type}: ${relativePath}`);
    
    // Create change object
    const change: FileChange = {
      path: relativePath,
      type,
    };
    
    // Read file content if needed
    if (type === 'add' || type === 'change') {
      try {
        // Don't read content here to avoid excessive disk I/O
        // Content will be read when processing the queue
      } catch (error) {
        logger.error(`Error reading file ${relativePath}:`, error);
      }
    }
    
    // Add to queue
    this.queue.set(relativePath, change);
    
    // Debounce processing
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.processQueue();
      this.debounceTimer = null;
    }, this.debounceDelay);
  }
  
  /**
   * Process queued file changes
   */
  private processQueue(): void {
    if (this.queue.size === 0) {
      return;
    }
    
    logger.debug(`Processing ${this.queue.size} file changes`);
    
    // Process each change
    const changes: FileChange[] = [];
    
    for (const [relativePath, change] of this.queue.entries()) {
      // For add/change, read file content now
      if (change.type === 'add' || change.type === 'change') {
        try {
          const filePath = path.join(this.projectRoot, relativePath);
          if (fs.existsSync(filePath)) {
            change.content = fs.readFileSync(filePath, 'utf-8');
          }
        } catch (error) {
          logger.error(`Error reading file ${relativePath}:`, error);
        }
      }
      
      changes.push(change);
    }
    
    // Clear queue
    this.queue.clear();
    
    // Emit changes
    if (changes.length > 0) {
      this.emit('changes', changes);
    }
  }
  
  /**
   * Load .gitignore patterns
   */
  private loadGitignore(): void {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        const patterns = content
          .split(/\r?\n/)
          .filter(line => line && !line.startsWith('#'))
          .map(line => line.trim());
        
        this.ignorePatterns = [...this.ignorePatterns, ...patterns];
        logger.debug(`Loaded ${patterns.length} patterns from .gitignore`);
      } catch (error) {
        logger.warn('Failed to load .gitignore:', error);
      }
    }
  }
  
  /**
   * Load .carverignore patterns
   */
  private loadCarverignore(): void {
    const carverignorePath = path.join(this.projectRoot, '.carverignore');
    
    if (fs.existsSync(carverignorePath)) {
      try {
        const content = fs.readFileSync(carverignorePath, 'utf-8');
        const patterns = content
          .split(/\r?\n/)
          .filter(line => line && !line.startsWith('#'))
          .map(line => line.trim());
        
        this.ignorePatterns = [...this.ignorePatterns, ...patterns];
        logger.debug(`Loaded ${patterns.length} patterns from .carverignore`);
      } catch (error) {
        logger.warn('Failed to load .carverignore:', error);
      }
    }
  }
  
  /**
   * Add a pattern to ignore
   * @param pattern Pattern to ignore
   */
  addIgnorePattern(pattern: string): void {
    if (!this.ignorePatterns.includes(pattern)) {
      this.ignorePatterns.push(pattern);
      
      // Update watcher if running
      if (this.watcher) {
        this.watcher.unwatch(pattern);
      }
    }
  }
  
  /**
   * Check if currently watching
   * @returns True if watching
   */
  isActive(): boolean {
    return this.isWatching;
  }
  
  /**
   * Get current status
   * @returns Status object
   */
  getStatus(): {
    active: boolean;
    projectRoot: string;
    ignorePatterns: string[];
  } {
    return {
      active: this.isWatching,
      projectRoot: this.projectRoot,
      ignorePatterns: this.ignorePatterns,
    };
  }
}
