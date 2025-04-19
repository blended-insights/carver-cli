import { Command } from 'commander';
import * as path from 'path';
import { logger } from '../utils/logger';
import { FileWatcher, FileChange } from '../services/fileWatcher';
import { ConfigService } from '../services/configService';
import { ApiService } from '../services/api';
import { CredentialService } from '../services/credentialService';

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Watch for file changes and sync with Carver')
    .option('-d, --directory <path>', 'Project directory to watch', process.cwd())
    .option('-i, --ignore <patterns>', 'Additional patterns to ignore (comma-separated)')
    .option('--no-git-ignore', 'Do not use .gitignore patterns')
    .option('--interval <ms>', 'Sync interval in milliseconds', '2000')
    .option('--dry-run', 'Only log changes without syncing to server')
    .action(async (options) => {
      try {
        // Normalize and validate directory
        const directory = path.resolve(options.directory);
        logger.info(`Watching directory: ${directory}`);
        
        // Check if project is initialized
        const configService = new ConfigService(directory);
        if (!configService.isInitialized()) {
          logger.error('Project is not initialized. Run "carver init" first.');
          process.exit(1);
        }
        
        // Get project configuration
        const projectConfig = configService.getConfig();
        if (!projectConfig || !projectConfig.projectId) {
          logger.error('Invalid project configuration');
          process.exit(1);
        }
        
        // Get API key
        const credentialService = new CredentialService();
        let apiKey = projectConfig.apiKey;
        
        if (!apiKey) {
          // Try to get stored API key
          apiKey = await credentialService.getApiKey();
          
          if (!apiKey) {
            logger.error('API key not found. Set it using "carver init" or environment variable CARVER_API_KEY');
            process.exit(1);
          }
        }
        
        // Initialize API service
        const apiService = new ApiService(apiKey);
        
        // Initialize file watcher
        const watcher = new FileWatcher(directory);
        
        // Add custom ignore patterns if provided
        if (options.ignore) {
          const patterns = options.ignore.split(',').map((p: string) => p.trim());
          patterns.forEach((pattern: string) => {
            watcher.addIgnorePattern(pattern);
          });
        }
        
        // Register file change handler
        watcher.on('changes', async (changes: FileChange[]) => {
          logger.info(`Detected ${changes.length} file changes`);
          
          // Skip syncing if in dry-run mode
          if (options.dryRun) {
            changes.forEach(change => {
              logger.info(`[DRY RUN] ${change.type.toUpperCase()}: ${change.path}`);
            });
            return;
          }
          
          try {
            // Process each change
            for (const change of changes) {
              if (change.type === 'add' || change.type === 'change') {
                if (change.content !== undefined) {
                  logger.debug(`Syncing file: ${change.path}`);
                  await apiService.updateFile(projectConfig.projectId, change.path, change.content);
                }
              } else if (change.type === 'unlink') {
                logger.debug(`Deleting file: ${change.path}`);
                await apiService.deleteFile(projectConfig.projectId, change.path);
              }
            }
            
            // Update last sync timestamp
            configService.updateConfig({
              lastSync: new Date().toISOString(),
            });
            
            logger.info('Sync completed successfully');
          } catch (error) {
            logger.error('Failed to sync changes:', error);
          }
        });
        
        // Handle watcher errors
        watcher.on('error', (error) => {
          logger.error('Watch error:', error);
        });
        
        // Start watching
        await watcher.start();
        
        // Ensure the process doesn't exit
        logger.info('Watching for changes (Press Ctrl+C to stop)');
        
        // Exit handler
        process.on('SIGINT', async () => {
          logger.info('Stopping watcher...');
          await watcher.stop();
          process.exit(0);
        });
      } catch (error) {
        logger.error('Watch command failed:', error);
        process.exit(1);
      }
    });
}
