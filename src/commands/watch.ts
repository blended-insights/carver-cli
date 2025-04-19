import { Command } from 'commander';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/configService';
import { FileSystemService } from '../services/fileSystem';
import { ApiService } from '../services/api';

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Watch the project for changes')
    .option('-d, --directory <path>', 'Project directory', process.cwd())
    .action(async (options) => {
      try {
        logger.info('Starting file watcher...');
        
        const configService = new ConfigService(options.directory);
        const config = configService.getConfig();
        
        if (!config) {
          logger.error('No Carver project found in this directory. Run `carver init` first.');
          process.exit(1);
        }
        
        const apiService = new ApiService(config.apiKey);
        const fsService = new FileSystemService(options.directory, apiService);
        
        await fsService.startWatching();
        
        // Keep the process alive
        process.stdin.resume();
        
        // Handle interruption signals
        process.on('SIGINT', async () => {
          logger.info('Stopping file watcher...');
          await fsService.stopWatching();
          process.exit(0);
        });
      } catch (error) {
        logger.error('Failed to start file watcher:', error);
        process.exit(1);
      }
    });
}
