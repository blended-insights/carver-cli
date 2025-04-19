import { Command } from 'commander';
import { ApiService } from '../services/api';
import { AuthService } from '../services/auth';
import { WebSocketService } from '../services/websocket';
import { RequestQueue } from '../utils/queue';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

/**
 * Create and configure the sync command
 */
export function createSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Synchronize local project with Carver cloud')
    .option('-p, --project <id>', 'Project ID to sync')
    .option('-w, --watch', 'Watch for changes and sync continuously')
    .option('-f, --force', 'Force full synchronization')
    .action(async (options) => {
      try {
        // Initialize services
        const authService = new AuthService();

        // Check authentication
        const isAuthenticated = await authService.isAuthenticated();
        if (!isAuthenticated) {
          logger.error('Authentication required. Please run "carver login" first.');
          process.exit(1);
        }

        // Initialize API service
        const apiService = new ApiService(authService);

        // Determine project ID
        const projectId = options.project || getConfig().defaultProject;
        if (!projectId) {
          logger.error(
            'Project ID required. Please specify with --project or set a default project.',
          );
          process.exit(1);
        }

        // Initialize WebSocket for real-time sync if watching
        if (options.watch) {
          const wsService = new WebSocketService(authService);

          // Connect to WebSocket
          await wsService.connect(projectId);

          // Subscribe to project updates
          await wsService.subscribeToProject(projectId);

          // Handle file update events
          wsService.on('file:updated', (data) => {
            logger.info(`Remote file updated: ${data.path}`);
            // Implement logic to update local file
          });

          wsService.on('file:created', (data) => {
            logger.info(`Remote file created: ${data.path}`);
            // Implement logic to create local file
          });

          wsService.on('file:deleted', (data) => {
            logger.info(`Remote file deleted: ${data.path}`);
            // Implement logic to delete local file
          });

          logger.info(`Watching project ${projectId} for changes...`);
          logger.info('Press Ctrl+C to stop watching.');

          // Keep process running
          process.on('SIGINT', async () => {
            logger.info('Stopping watch...');
            await wsService.disconnect();
            process.exit(0);
          });
        } else {
          // One-time sync
          logger.info(`Synchronizing project ${projectId}...`);

          // Initialize request queue for offline operations
          const syncQueue = new RequestQueue<{
            projectId: string;
            filePath: string;
            content?: string | Buffer;
            operation: 'create' | 'update' | 'delete';
          }>('sync');

          // Set up queue processor
          syncQueue.setProcessor(async (item) => {
            const { projectId, filePath, content, operation } = item.data;

            switch (operation) {
              case 'create':
              case 'update':
                if (content) {
                  await apiService.updateFile(projectId, filePath, content);
                  logger.debug(`Uploaded ${filePath}`);
                }
                break;
              case 'delete':
                await apiService.deleteFile(projectId, filePath);
                logger.debug(`Deleted ${filePath}`);
                break;
            }
          });

          // Process any queued operations
          const queueCounts = syncQueue.getItemCounts();
          if (queueCounts.pending > 0 || queueCounts.failed > 0) {
            logger.info(
              `Processing ${queueCounts.pending + queueCounts.failed} queued operations...`,
            );

            // Retry failed items
            syncQueue.retryAllFailed();

            // Process the queue
            await syncQueue.processQueue();
          }

          // Sync with cloud
          const syncResult = await apiService.syncProject(projectId);

          logger.info(
            `Synchronization complete. ${syncResult.added || 0} added, ${syncResult.updated || 0} updated, ${syncResult.deleted || 0} deleted.`,
          );
        }
      } catch (error) {
        logger.error('Sync failed:', error);
        process.exit(1);
      }
    });
}
