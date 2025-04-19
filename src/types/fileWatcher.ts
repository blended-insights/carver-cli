import { EventEmitter } from 'events';

/**
 * Types of file changes that can be detected
 */
export type FileChangeType = 'add' | 'change' | 'unlink';

/**
 * Interface representing a file change
 */
export interface FileChange {
  /**
   * Relative path to the file from project root
   */
  path: string;
  
  /**
   * Type of change detected
   */
  type: FileChangeType;
  
  /**
   * File content (string for text files, Buffer for binary files)
   */
  content?: string | Buffer;
  
  /**
   * Hash of file content for detecting changes
   */
  hash?: string;
  
  /**
   * Whether the file is binary
   */
  isBinary?: boolean;
}

/**
 * Options for file watcher
 */
export interface FileWatcherOptions {
  /**
   * Debounce delay in milliseconds for file change events
   */
  debounceDelay?: number;
  
  /**
   * Batch interval in milliseconds for sending changes
   */
  batchInterval?: number;
  
  /**
   * Whether to use gitignore patterns
   */
  useGitignore?: boolean;
  
  /**
   * Whether to use carverignore patterns
   */
  useCarverignore?: boolean;
  
  /**
   * Additional patterns to ignore
   */
  ignorePatterns?: string[];
}

/**
 * Status of file watcher
 */
export interface FileWatcherStatus {
  /**
   * Whether watcher is active
   */
  active: boolean;
  
  /**
   * Whether watcher is paused
   */
  paused: boolean;
  
  /**
   * Root directory being watched
   */
  projectRoot: string;
  
  /**
   * Patterns being ignored
   */
  ignorePatterns: string[];
  
  /**
   * Number of files in queue
   */
  queueSize: number;
  
  /**
   * Number of files in cache
   */
  cachedFiles: number;
}

/**
 * Interface for file watcher event handling
 */
export interface FileWatcherEvents {
  /**
   * Emitted when file changes are detected and batched
   */
  changes: (changes: FileChange[]) => void;
  
  /**
   * Emitted when an error occurs
   */
  error: (error: Error) => void;
  
  /**
   * Emitted when watcher is ready
   */
  ready: () => void;
  
  /**
   * Emitted when watcher is stopped
   */
  stop: () => void;
  
  /**
   * Emitted when watcher is paused
   */
  paused: () => void;
  
  /**
   * Emitted when watcher is resumed
   */
  resumed: () => void;
}

/**
 * Interface for file watcher implementation
 */
export interface IFileWatcher extends EventEmitter {
  /**
   * Start watching for file changes
   * @returns Promise that resolves when watcher is ready
   */
  start(): Promise<void>;
  
  /**
   * Stop watching for file changes
   * @returns Promise that resolves when watcher is closed
   */
  stop(): Promise<void>;
  
  /**
   * Pause watching (temporarily stop processing changes)
   */
  pause(): void;
  
  /**
   * Resume watching
   */
  resume(): void;
  
  /**
   * Add a pattern to ignore
   * @param pattern Pattern to ignore
   */
  addIgnorePattern(pattern: string): void;
  
  /**
   * Check if watcher is active
   * @returns True if watcher is active
   */
  isActive(): boolean;
  
  /**
   * Check if watcher is paused
   * @returns True if watcher is paused
   */
  isPaused(): boolean;
  
  /**
   * Get current status of watcher
   * @returns Watcher status
   */
  getStatus(): FileWatcherStatus;
  
  /**
   * Add event listener for file watcher events
   * @param event Event name
   * @param listener Event listener
   */
  on<E extends keyof FileWatcherEvents>(
    event: E,
    listener: FileWatcherEvents[E]
  ): this;
  
  /**
   * Remove event listener
   * @param event Event name
   * @param listener Event listener
   */
  off<E extends keyof FileWatcherEvents>(
    event: E,
    listener: FileWatcherEvents[E]
  ): this;
  
  /**
   * Add one-time event listener
   * @param event Event name
   * @param listener Event listener
   */
  once<E extends keyof FileWatcherEvents>(
    event: E,
    listener: FileWatcherEvents[E]
  ): this;
  
  /**
   * Emit event
   * @param event Event name
   * @param args Event arguments
   */
  emit<E extends keyof FileWatcherEvents>(
    event: E,
    ...args: Parameters<FileWatcherEvents[E]>
  ): boolean;
}
