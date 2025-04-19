import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

/**
 * Get patterns to ignore based on gitignore file
 * @param projectRoot Root directory of the project
 * @returns Array of patterns to ignore
 */
export async function getIgnorePatterns(projectRoot: string): Promise<string[]> {
  const patterns: string[] = [
    // Default patterns to ignore
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/.idea/**',
    '**/.vscode/**',
    '**/coverage/**',
    '**/build/**',
    // Additional defaults for Carver-specific files
    '**/.carver/**',
  ];
  
  try {
    // Read .gitignore file
    const gitignorePath = path.join(projectRoot, '.gitignore');
    
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      const gitignoreLines = gitignoreContent.split('\n');
      
      // Process lines
      for (const line of gitignoreLines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // Handle negation (includes)
        if (trimmedLine.startsWith('!')) {
          // Not implemented yet - requires more complex ignore logic
          continue;
        }
        
        // Add pattern - convert to glob pattern if needed
        if (trimmedLine.endsWith('/')) {
          // Directory pattern
          patterns.push(`**/${trimmedLine}**`);
        } else {
          // File pattern
          patterns.push(`**/${trimmedLine}`);
        }
      }
      
      logger.debug(`Loaded ${patterns.length - 7} patterns from .gitignore`);
    } else {
      logger.debug('No .gitignore file found, using default ignore patterns');
    }
  } catch (error) {
    logger.warn('Failed to parse .gitignore file, using default ignore patterns:', error);
  }
  
  return patterns;
}
