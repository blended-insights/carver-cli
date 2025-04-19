import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { ProjectInitializer } from '../services/projectInitializer';
import { CredentialService } from '../services/credentialService';
import { ApiService } from '../services/api';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new Carver project')
    .option('-k, --key <key>', 'Carver Hub API key')
    .option('-p, --project <id>', 'Carver Hub project ID')
    .option('-d, --directory <path>', 'Project directory', process.cwd())
    .option('-n, --name <name>', 'Project name')
    .option('--description <text>', 'Project description')
    .option('-f, --force', 'Force reinitialization if project already exists')
    .option('--no-git', 'Skip Git repository detection')
    .option('--store-key', 'Store API key securely in system keychain', false)
    .action(async (options) => {
      try {
        logger.info('Initializing Carver project...');
        
        // Normalize directory path
        const directory = path.resolve(options.directory);
        logger.debug(`Using directory: ${directory}`);
        
        // Verify directory exists
        if (!fs.existsSync(directory)) {
          logger.error(`Directory does not exist: ${directory}`);
          process.exit(1);
        }
        
        // Get API key
        let apiKey = options.key || process.env.CARVER_API_KEY;
        const credentialService = new CredentialService();
        
        if (!apiKey) {
          // Try to get stored API key
          apiKey = await credentialService.getApiKey();
          
          if (!apiKey) {
            logger.error('API key is required. Use --key option or set CARVER_API_KEY environment variable.');
            process.exit(1);
          }
        }
        
        // Verify API key
        logger.debug('Verifying API key...');
        const apiService = new ApiService(apiKey);
        const isKeyValid = await apiService.verifyApiKey();
        
        if (!isKeyValid) {
          logger.error('Invalid API key. Please check your credentials.');
          process.exit(1);
        }
        
        logger.debug('API key verified successfully');
        
        // Store API key securely if requested
        if (options.storeKey) {
          logger.debug('Storing API key in system keychain...');
          await credentialService.storeApiKey(apiKey);
          logger.info('API key stored securely');
        }
        
        // Initialize project
        const initializer = new ProjectInitializer();
        const initResult = await initializer.initialize({
          key: apiKey,
          project: options.project,
          directory,
          name: options.name,
          description: options.description,
          useGit: options.git !== false,
          force: options.force === true,
        });
        
        // Store project credentials
        if (initResult.projectId) {
          await credentialService.storeProjectCredentials(initResult.projectId, {
            apiKey,
            directory,
            lastSync: new Date().toISOString(),
          });
        }
        
        logger.info(`Project "${initResult.projectName}" initialized successfully`);
        logger.info(`Project ID: ${initResult.projectId}`);
        logger.info('Run "carver status" to see project details');
        logger.info('Run "carver watch" to start watching for file changes');
      } catch (error) {
        logger.error('Failed to initialize project:', error);
        process.exit(1);
      }
    });
}
