/* eslint-disable no-console */

import { Command } from 'commander';
import * as path from 'path';
import * as readline from 'readline';
import { logger } from '../utils/logger';
import { FileWatcher } from '../services/fileWatcher';
import { FileChange } from '../types/fileWatcher';
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
    .option('--debounce <ms>', 'Debounce delay in milliseconds', '500')
    .option('--batch <ms>', 'Batch interval in milliseconds', '2000')
    .option('--dry-run', 'Only log changes without syncing to server')
    .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
    .option('--interactive', 'Enable interactive mode with commands')
    .action(async (options) => {
      try {
        // Set log level if provided
        if (options.logLevel) {
          logger.level = options.logLevel;
        }

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
            logger.error(
              'API key not found. Set it using "carver init" or environment variable CARVER_API_KEY',
            );
            process.exit(1);
          }
        }

        // Initialize API service
        const apiService = new ApiService(apiKey);

        // Initialize file watcher with options
        const watcher = new FileWatcher(directory, {
          debounceDelay: parseInt(options.debounce, 10),
          batchInterval: parseInt(options.batch, 10),
        });

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
            changes.forEach((change) => {
              logger.info(
                `[DRY RUN] ${change.type.toUpperCase()}: ${change.path}${change.isBinary ? ' (binary)' : ''}`,
              );
            });
            return;
          }

          try {
            // Group changes to use batch API when possible
            const filesToUpdate: Array<{ path: string; content: string | Buffer }> = [];
            const filesToDelete: string[] = [];

            // Process each change
            for (const change of changes) {
              if (change.type === 'add' || change.type === 'change') {
                if (change.content !== undefined) {
                  filesToUpdate.push({
                    path: change.path,
                    content: change.content,
                  });
                }
              } else if (change.type === 'unlink') {
                filesToDelete.push(change.path);
              }
            }

            // Process updates in batches
            if (filesToUpdate.length > 0) {
              logger.debug(`Syncing ${filesToUpdate.length} files`);

              // Use batch update if available and more than one file to update
              if (filesToUpdate.length > 1) {
                await apiService.updateFiles(projectConfig.projectId, filesToUpdate);
              } else {
                // Single file update
                const file = filesToUpdate[0];
                await apiService.updateFile(projectConfig.projectId, file.path, file.content);
              }
            }

            // Process deletes one by one (no batch API for deletes yet)
            for (const filePath of filesToDelete) {
              logger.debug(`Deleting file: ${filePath}`);
              await apiService.deleteFile(projectConfig.projectId, filePath);
            }

            // Update last sync timestamp
            configService.updateConfig({
              lastSync: new Date().toISOString(),
            });

            logger.info(
              `Sync completed successfully (${filesToUpdate.length} updates, ${filesToDelete.length} deletions)`,
            );
          } catch (error) {
            logger.error('Failed to sync changes:', error);
          }
        });

        // Handle watcher events
        watcher.on('error', (error) => {
          logger.error('Watch error:', error);
        });

        watcher.on('paused', () => {
          logger.info('Watcher paused');
        });

        watcher.on('resumed', () => {
          logger.info('Watcher resumed');
        });

        // Start watching
        await watcher.start();

        // Show initial status
        const status = watcher.getStatus();
        logger.info(`Watching ${status.projectRoot}`);
        logger.info(`Ignored patterns: ${status.ignorePatterns.length}`);

        // Setup interactive mode if requested
        if (options.interactive) {
          setupInteractiveMode(watcher, apiService, projectConfig.projectId);
        } else {
          // Just show basic instructions
          logger.info('Watching for changes (Press Ctrl+C to stop)');
        }

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

/**
 * Set up interactive mode with commands
 * @param watcher File watcher instance
 * @param apiService API service instance
 * @param projectId Project ID
 */
function setupInteractiveMode(
  watcher: FileWatcher,
  apiService: ApiService,
  projectId: string,
): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'carver> ',
  });

  logger.info('Interactive mode enabled. Available commands:');
  logger.info('  status   - Show watcher status');
  logger.info('  pause    - Pause watching');
  logger.info('  resume   - Resume watching');
  logger.info('  sync     - Force sync project with server');
  logger.info('  clear    - Clear console');
  logger.info('  help     - Show this help');
  logger.info('  exit     - Exit watcher');
  logger.info('Press Enter to show prompt');

  rl.prompt();

  rl.on('line', async (line: string) => {
    const command = line.trim().toLowerCase();

    try {
      switch (command) {
        case 'status':
          const status = watcher.getStatus();
          logger.info(
            `Status: ${status.active ? 'Active' : 'Inactive'}${status.paused ? ' (Paused)' : ''}`,
          );
          logger.info(`Directory: ${status.projectRoot}`);
          logger.info(`Cached files: ${status.cachedFiles}`);
          logger.info(`Queue size: ${status.queueSize}`);
          break;

        case 'pause':
          watcher.pause();
          break;

        case 'resume':
          watcher.resume();
          break;

        case 'sync':
          logger.info('Forcing project sync...');
          try {
            const result = await apiService.syncProject(projectId);
            logger.info('Sync completed successfully');
          } catch (error) {
            logger.error('Sync failed:', error);
          }
          break;

        case 'clear':
          console.clear();
          break;

        case 'help':
          logger.info('Available commands:');
          logger.info('  status   - Show watcher status');
          logger.info('  pause    - Pause watching');
          logger.info('  resume   - Resume watching');
          logger.info('  sync     - Force sync project with server');
          logger.info('  clear    - Clear console');
          logger.info('  help     - Show this help');
          logger.info('  exit     - Exit watcher');
          break;

        case 'exit':
          logger.info('Stopping watcher...');
          await watcher.stop();
          rl.close();
          process.exit(0);
          break;

        default:
          if (command) {
            logger.warn(`Unknown command: ${command}`);
            logger.info('Type "help" for available commands');
          }
          break;
      }
    } catch (error) {
      logger.error('Command failed:', error);
    }

    rl.prompt();
  });
}
