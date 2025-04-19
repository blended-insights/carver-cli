import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

/**
 * Interface for ignore pattern options
 */
export interface IgnoreOptions {
  useGitignore?: boolean;
  useCarverignore?: boolean;
  additionalPatterns?: string[];
}

/**
 * Default patterns to ignore
 */
const DEFAULT_IGNORE_PATTERNS = [
  // Common directories
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/.idea/**',
  '**/.vscode/**',
  '**/coverage/**',
  '**/build/**',
  // Build artifacts
  '**/*.min.js',
  '**/*.bundle.js',
  '**/vendor/**',
  // Package management
  '**/package-lock.json',
  '**/yarn.lock',
  '**/yarn-error.log',
  // Logs
  '**/logs/**',
  '**/*.log',
  // Cache
  '**/.cache/**',
  '**/.npm/**',
  '**/.eslintcache',
  // OS specific
  '**/.DS_Store',
  '**/.directory',
  '**/desktop.ini',
  '**/Thumbs.db',
  // Additional defaults for Carver-specific files
  '**/.carver/**',
];

/**
 * Convert a gitignore pattern to chokidar glob pattern
 * @param pattern Gitignore pattern
 * @returns Chokidar compatible glob pattern
 */
function convertGitignorePatternToGlob(pattern: string): string {
  // Trim the pattern
  let trimmedPattern = pattern.trim();

  // Skip empty lines and comments
  if (!trimmedPattern || trimmedPattern.startsWith('#')) {
    return '';
  }

  // Handle negation (includes) - not fully supported yet
  if (trimmedPattern.startsWith('!')) {
    return '';
  }

  // Remove leading slash if present (gitignore uses it for repo root)
  if (trimmedPattern.startsWith('/')) {
    trimmedPattern = trimmedPattern.substring(1);
  }

  // Convert directory pattern
  if (trimmedPattern.endsWith('/')) {
    return `**/${trimmedPattern}**`;
  }

  // Convert file pattern (simple glob)
  return `**/${trimmedPattern}`;
}

/**
 * Parse ignore file content into an array of patterns
 * @param content Content of ignore file
 * @returns Array of glob patterns
 */
function parseIgnoreFileContent(content: string): string[] {
  return content
    .split(/\r?\n/) // Split by newlines (cross-platform)
    .map((line) => convertGitignorePatternToGlob(line))
    .filter((pattern) => pattern !== ''); // Remove empty patterns
}

/**
 * Read patterns from an ignore file
 * @param filePath Path to ignore file
 * @returns Array of patterns or empty array if file doesn't exist
 */
function readIgnoreFile(filePath: string): string[] {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const patterns = parseIgnoreFileContent(content);
      logger.debug(`Loaded ${patterns.length} patterns from ${path.basename(filePath)}`);
      return patterns;
    }
  } catch (error) {
    logger.warn(`Failed to parse ${path.basename(filePath)}:`, error);
  }

  return [];
}

/**
 * Get all global ignore patterns
 * @returns Global ignore patterns
 */
export function getGlobalIgnorePatterns(): string[] {
  const homeDir = os.homedir();
  const globalGitignorePath = path.join(homeDir, '.gitignore');
  const globalCarverignorePath = path.join(homeDir, '.carverignore');

  const patterns: string[] = [];

  // Add patterns from global .gitignore
  patterns.push(...readIgnoreFile(globalGitignorePath));

  // Add patterns from global .carverignore
  patterns.push(...readIgnoreFile(globalCarverignorePath));

  return patterns;
}

/**
 * Get patterns to ignore based on gitignore and carverignore files
 * @param projectRoot Root directory of the project
 * @param options Options for ignore pattern generation
 * @returns Array of patterns to ignore
 */
export async function getIgnorePatterns(
  projectRoot: string,
  options: IgnoreOptions = {},
): Promise<string[]> {
  const { useGitignore = true, useCarverignore = true, additionalPatterns = [] } = options;

  // Start with default patterns
  const patterns = [...DEFAULT_IGNORE_PATTERNS];

  // Add global ignore patterns
  patterns.push(...getGlobalIgnorePatterns());

  // Add project-specific ignore patterns
  if (useGitignore) {
    const gitignorePath = path.join(projectRoot, '.gitignore');
    patterns.push(...readIgnoreFile(gitignorePath));
  }

  if (useCarverignore) {
    const carverignorePath = path.join(projectRoot, '.carverignore');
    patterns.push(...readIgnoreFile(carverignorePath));
  }

  // Add any additional patterns
  if (additionalPatterns.length > 0) {
    patterns.push(...additionalPatterns);
    logger.debug(`Added ${additionalPatterns.length} additional ignore patterns`);
  }

  return patterns;
}
