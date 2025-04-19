import { Command } from 'commander';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/configService';
import { ApiService } from '../services/api';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check the status of the Carver project')
    .option('-d, --directory <path>', 'Project directory', process.cwd())
    .action(async (options) => {
      try {
        logger.info('Checking project status...');
        
        const configService = new ConfigService(options.directory);
        const config = configService.getConfig();
        
        if (!config) {
          logger.error('No Carver project found in this directory. Run `carver init` first.');
          process.exit(1);
        }
        
        const apiService = new ApiService(config.apiKey);
        const status = await apiService.getProjectStatus(config.projectId);
        
        logger.info('Project Status:', status);
      } catch (error) {
        logger.error('Failed to check project status:', error);
        process.exit(1);
      }
    });
}
