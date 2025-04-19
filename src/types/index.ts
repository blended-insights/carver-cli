/**
 * Project configuration interface
 */
export interface ProjectConfig {
  projectId: string;
  projectName?: string;
  apiKey?: string;
  lastSync?: string;
  settings?: ProjectSettings;
}

/**
 * Project settings interface
 */
export interface ProjectSettings {
  ignorePatterns?: string[];
  syncInterval?: number;
  excludeExtensions?: string[];
  maxFileSize?: number;
  watchMode?: 'polling' | 'native';
}

/**
 * Global configuration interface
 */
export interface GlobalConfig {
  version: string;
  apiEndpoint: string;
  timeout: number;
  maxWatchPaths: number;
  ignorePatterns: string[];
  logLevel?: string;
  logFile?: string;
}

// Re-export file watcher types
export * from './fileWatcher';

/**
 * Project info interface
 */
export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

/**
 * Project status interface
 */
export interface ProjectStatus {
  id: string;
  status: 'active' | 'inactive' | 'syncing' | 'error';
  lastSync?: string;
  fileCount?: number;
  errorMessage?: string;
}

/**
 * File stats interface
 */
export interface FileStats {
  path: string;
  size: number;
  lastModified: string;
  contentType: string;
}

/**
 * Project statistics interface
 */
export interface ProjectStats {
  fileCount: number;
  totalSize: number;
  lastModified: string;
  languageStats: Record<string, number>;
}

/**
 * Initialization options interface
 */
export interface InitializationOptions {
  key: string;
  project?: string;
  directory: string;
  name?: string;
  description?: string;
  useGit?: boolean;
  force?: boolean;
}

/**
 * Initialization result interface
 */
export interface InitializationResult {
  projectId: string;
  projectName: string;
  configPath: string;
}

/**
 * Prompt generation parameters interface
 */
export interface PromptParams {
  projectId: string;
  template: string;
  filePath?: string;
  context?: any;
}
