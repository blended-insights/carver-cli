/**
 * Global configuration
 */
export interface GlobalConfig {
  version: string;
  apiEndpoint: string;
  timeout: number;
  logLevel?: string;
  logFile?: string;
}

/**
 * Project configuration
 */
export interface ProjectConfig {
  projectId: string;
  apiKey: string;
  lastSync: string;
  watchPatterns?: string[];
  ignorePatterns?: string[];
}

/**
 * Command options for init command
 */
export interface InitCommandOptions {
  key?: string;
  project?: string;
  directory: string;
  force?: boolean;
}

/**
 * Command options for status command
 */
export interface StatusCommandOptions {
  directory: string;
}

/**
 * Command options for watch command
 */
export interface WatchCommandOptions {
  directory: string;
}

/**
 * Command options for prompt command
 */
export interface PromptCommandOptions {
  directory: string;
  template?: string;
  file?: string;
}
