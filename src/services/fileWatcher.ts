import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { EventEmitter } from 'events';
import { getFileHash, isBinaryFile, processFile } from '../utils/hash';
import { FileChange, FileWatcherOptions, FileWatcherStatus, IFileWatcher } from '../types/fileWatcher';
import { getIgnorePatterns, IgnoreOptions } from '../utils/gitignore';

/**
 * File watcher implementation that monitors changes in project files
 * and synchronizes them with the cloud API
 */
export class FileWatcher extends EventEmitter implements IFileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private projectRoot: string;
  private isWatching: boolean = false;
  private ignorePatterns: string[] = [];
  private queue: Map<string, FileChange> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceDelay: number = 500; // ms
  private batchInterval: number = 2000; // ms
  private batchTimer: NodeJS.Timeout | null = null;
  private fileCache: Map<string, string> = new Map(); // Path to hash cache
  private paused: boolean = false;
  private tmpDir: string;
  
  /**
   * Create a new file watcher
   * @param projectRoot Root directory of the project to watch
   * @param options Options for the file watcher
   */
  constructor(projectRoot: string, options?: FileWatcherOptions) {
    super();
    this.projectRoot = projectRoot;
    
  // Set options from parameters if provided
    if (options) {
      if (options.debounceDelay) this.debounceDelay = options.debounceDelay;
      if (options.batchInterval) this.batchInterval = options.batchInterval;
    }
    
    // Get ignore patterns from config
    const config = getConfig();
    this.ignorePatterns = config.ignorePatterns || [];
    
    // Add additional ignore patterns from options
    if (options?.ignorePatterns) {
      this.ignorePatterns = [...this.ignorePatterns, ...options.ignorePatterns];
    }
    
    // Initialize temporary directory for file operations
    this.tmpDir = path.join(os.homedir(), '.carver', 'tmp');
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
    
    // Load project-specific ignore patterns
    this.loadIgnorePatterns(options);
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
    
    // Reset paused state when starting
    this.paused = false;
    
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
      alwaysStat: true, // Get file stats for better change detection
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
    
    // Clear any pending timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Process any remaining queued changes
    this.processQueue();
    
    // Close the watcher
    return this.watcher.close().then(() => {
      this.isWatching = false;
      this.watcher = null;
      logger.info('File watcher stopped');
      this.emit('stop');
      // Clear file cache when stopping
      this.fileCache.clear();
    });
  }
  
  /**
   * Handle file change event
   * @param filePath Path to changed file
   * @param type Type of change
   */
  private handleFileChange(filePath: string, type: 'add' | 'change' | 'unlink'): void {
    // Skip if paused
    if (this.paused) {
      return;
    }
    
    // Convert to relative path
    const relativePath = path.relative(this.projectRoot, filePath);
    
    logger.debug(`File ${type}: ${relativePath}`);
    
    // Create change object
    const change: FileChange = {
      path: relativePath,
      type,
    };
    
    // For delete operations, remove from hash cache
    if (type === 'unlink') {
      this.fileCache.delete(relativePath);
    }
    
    // Add to queue (we'll process content at queue processing time)
    this.queue.set(relativePath, change);
    
    // Debounce processing
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      // If batcher isn't running, start it
      if (!this.batchTimer) {
        this.startBatcher();
      }
      this.debounceTimer = null;
    }, this.debounceDelay);
  }
  
  /**
   * Process queued file changes
   */
  private async processQueue(): Promise<void> {
    if (this.queue.size === 0) {
      return;
    }
    
    logger.debug(`Processing ${this.queue.size} file changes`);
    
    // Process each change
    const changes: FileChange[] = [];
    const pendingProcesses: Promise<void>[] = [];
    
    for (const [relativePath, change] of this.queue.entries()) {
      // For add/change, process file content
      if (change.type === 'add' || change.type === 'change') {
        const promise = this.processFileChange(relativePath, change);
        pendingProcesses.push(promise);
      } else {
        // For unlink, we don't need to process anything
        changes.push(change);
      }
    }
    
    // Wait for all file processing to complete
    await Promise.all(pendingProcesses);
    
    // Gather all changes (including processed ones)
    for (const [relativePath, change] of this.queue.entries()) {
      if (change.type === 'add' || change.type === 'change') {
        // Skip files that haven't changed (based on hash)
        if (change.hash && this.fileCache.has(relativePath) && this.fileCache.get(relativePath) === change.hash) {
          logger.debug(`Skipping unchanged file: ${relativePath}`);
          continue;
        }
        
        // Update cache with new hash
        if (change.hash) {
          this.fileCache.set(relativePath, change.hash);
        }
      }
      
      changes.push(change);
    }
    
    // Clear queue
    this.queue.clear();
    
    // Emit changes
    if (changes.length > 0) {
      this.emit('changes', changes);
    } else {
      logger.debug('No actual changes detected after filtering');
    }
  }
  
  /**
   * Load ignore patterns from gitignore and carverignore files
   * @param options File watcher options
   */
  private async loadIgnorePatterns(options?: FileWatcherOptions): Promise<void> {
    try {
      // Create options for gitignore parsing
      const ignoreOptions: IgnoreOptions = {
        useGitignore: options?.useGitignore !== false, // Default to true
        useCarverignore: options?.useCarverignore !== false, // Default to true
        additionalPatterns: options?.ignorePatterns || [],
      };
      
      // Get ignore patterns
      const patterns = await getIgnorePatterns(this.projectRoot, ignoreOptions);
      
      // Add to existing patterns (if not already present)
      for (const pattern of patterns) {
        if (!this.ignorePatterns.includes(pattern)) {
          this.ignorePatterns.push(pattern);
        }
      }
      
      logger.debug(`Loaded ${patterns.length} ignore patterns`);
    } catch (error) {
      logger.warn('Failed to load ignore patterns:', error);
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
   * Start batching timer for processing changes
   */
  private startBatcher(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(async () => {
      await this.processQueue();
      this.batchTimer = null;
      
      // If queue is not empty after processing, start another batch timer
      if (this.queue.size > 0) {
        this.startBatcher();
      }
    }, this.batchInterval);
  }
  
  /**
   * Process a file change by reading content and calculating hash
   */
  private async processFileChange(relativePath: string, change: FileChange): Promise<void> {
    try {
      const filePath = path.join(this.projectRoot, relativePath);
      
      // Skip if file doesn't exist anymore
      if (!fs.existsSync(filePath)) {
        return;
      }
      
      // Process file (read content and calculate hash)
      const { content, hash, isBinary } = await processFile(filePath);
      
      // Update change object with file info
      change.content = content;
      change.hash = hash;
      change.isBinary = isBinary;
    } catch (error) {
      logger.error(`Error processing file ${relativePath}:`, error);
    }
  }
  
  /**
   * Pause the watcher (stop processing changes temporarily)
   */
  pause(): void {
    if (!this.isWatching) {
      logger.warn('Cannot pause: watcher is not running');
      return;
    }
    
    if (this.paused) {
      logger.debug('Watcher is already paused');
      return;
    }
    
    this.paused = true;
    logger.info('Watcher paused');
    this.emit('paused');
  }
  
  /**
   * Resume the watcher
   */
  resume(): void {
    if (!this.isWatching) {
      logger.warn('Cannot resume: watcher is not running');
      return;
    }
    
    if (!this.paused) {
      logger.debug('Watcher is not paused');
      return;
    }
    
    this.paused = false;
    logger.info('Watcher resumed');
    this.emit('resumed');
  }
  
  /**
   * Check if currently watching
   * @returns True if watching
   */
  isActive(): boolean {
    return this.isWatching;
  }
  
  /**
   * Check if currently paused
   * @returns True if paused
   */
  isPaused(): boolean {
    return this.paused;
  }
  
  /**
   * Get current status
   * @returns Status object
   */
  getStatus(): FileWatcherStatus {
    return {
      active: this.isWatching,
      paused: this.paused,
      projectRoot: this.projectRoot,
      ignorePatterns: this.ignorePatterns,
      queueSize: this.queue.size,
      cachedFiles: this.fileCache.size,
    };
  }
}
