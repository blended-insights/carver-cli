import { Command } from 'commander';
import { logger } from '../utils/logger';
import { ProjectInitializer } from '../services/projectInitializer';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new Carver project')
    .option('-k, --key <key>', 'Carver Hub API key')
    .option('-p, --project <id>', 'Carver Hub project ID')
    .option('-d, --directory <path>', 'Project directory', process.cwd())
    .action(async (options) => {
      try {
        logger.info('Initializing Carver project...');
        const initializer = new ProjectInitializer();
        await initializer.initialize(options);
        logger.info('Project initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize project:', error);
        process.exit(1);
      }
    });
}
