/* eslint-disable no-console */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/configService';
import { ApiService } from '../services/api';
import { CredentialService } from '../services/credentialService';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check the status of a Carver project')
    .option('-d, --directory <path>', 'Project directory', process.cwd())
    .option('-v, --verbose', 'Show detailed status information')
    .option('--json', 'Output status as JSON')
    .action(async (options) => {
      try {
        // Normalize directory path
        const directory = path.resolve(options.directory);

        // Verify directory exists
        if (!fs.existsSync(directory)) {
          logger.error(`Directory does not exist: ${directory}`);
          process.exit(1);
        }

        // Check if project is initialized
        const configService = new ConfigService(directory);
        if (!configService.isInitialized()) {
          if (options.json) {
            console.log(
              JSON.stringify({
                initialized: false,
                directory,
              }),
            );
          } else {
            logger.info(`Project is not initialized in ${directory}`);
            logger.info('Run "carver init" to initialize a new project');
          }
          return;
        }

        // Get project configuration
        const config = configService.getConfig();
        if (!config || !config.projectId) {
          logger.error('Invalid project configuration');
          process.exit(1);
        }

        // Get API key
        const credentialService = new CredentialService();
        let apiKey = config.apiKey;

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

        try {
          // Get project status from API
          const projectStatus = await apiService.getProjectStatus(config.projectId);
          const projectInfo = await apiService.getProject(config.projectId);

          // Get project statistics if verbose mode is enabled
          let projectStats = null;
          if (options.verbose) {
            projectStats = await apiService.getProjectStats(config.projectId);
          }

          // Format last sync time
          const lastSync = config.lastSync ? new Date(config.lastSync) : null;
          const lastSyncFormatted = lastSync ? lastSync.toLocaleString() : 'Never';

          // Calculate time since last sync
          let timeSinceSync = 'Never synced';
          if (lastSync) {
            const now = new Date();
            const diffMs = now.getTime() - lastSync.getTime();
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) {
              timeSinceSync = 'Less than a minute ago';
            } else if (diffMins < 60) {
              timeSinceSync = `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
            } else if (diffMins < 1440) {
              const hours = Math.floor(diffMins / 60);
              timeSinceSync = `${hours} hour${hours === 1 ? '' : 's'} ago`;
            } else {
              const days = Math.floor(diffMins / 1440);
              timeSinceSync = `${days} day${days === 1 ? '' : 's'} ago`;
            }
          }

          // Output status
          if (options.json) {
            console.log(
              JSON.stringify(
                {
                  initialized: true,
                  directory,
                  project: {
                    id: config.projectId,
                    name: projectInfo.name,
                    description: projectInfo.description,
                    status: projectStatus.status,
                    lastSync: config.lastSync,
                    stats: projectStats,
                  },
                },
                null,
                2,
              ),
            );
          } else {
            logger.info('=== Carver Project Status ===');
            logger.info(`Project: ${projectInfo.name}`);
            logger.info(`Directory: ${directory}`);
            logger.info(`Project ID: ${config.projectId}`);
            logger.info(`Status: ${projectStatus.status}`);
            logger.info(`Last Sync: ${lastSyncFormatted} (${timeSinceSync})`);

            if (options.verbose && projectStats) {
              logger.info('\n=== Project Statistics ===');
              logger.info(`Files: ${projectStats.fileCount}`);
              logger.info(`Total Size: ${formatBytes(projectStats.totalSize)}`);
              logger.info(`Last Modified: ${new Date(projectStats.lastModified).toLocaleString()}`);

              if (projectStats.languageStats) {
                logger.info('\n=== Language Statistics ===');
                Object.entries(projectStats.languageStats).forEach(([language, count]) => {
                  logger.info(`${language}: ${count} files`);
                });
              }
            }
          }
        } catch (error) {
          if (options.json) {
            console.log(
              JSON.stringify({
                initialized: true,
                directory,
                project: {
                  id: config.projectId,
                  error: 'Failed to fetch project status',
                },
              }),
            );
          } else {
            logger.error('Failed to fetch project status:', error);
            logger.info(`Project ID: ${config.projectId}`);
            logger.info(`Directory: ${directory}`);
            logger.info(
              `Last Sync: ${config.lastSync ? new Date(config.lastSync).toLocaleString() : 'Never'}`,
            );
          }
        }
      } catch (error) {
        logger.error('Status command failed:', error);
        process.exit(1);
      }
    });
}

/**
 * Format bytes to human-readable string
 * @param bytes Number of bytes
 * @returns Formatted string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
