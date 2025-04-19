import { Command } from 'commander';
import * as readline from 'readline';
import { logger } from '../utils/logger';
import { ApiService } from '../services/api';
import { CredentialService } from '../services/credentialService';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Log in to Carver with your API key')
    .option('-k, --key <key>', 'Carver API key')
    .option('--force', 'Force login even if already logged in')
    .action(async (options) => {
      try {
        const credentialService = new CredentialService();
        
        // Check if already logged in
        const existingKey = await credentialService.getApiKey();
        
        if (existingKey && !options.force && !options.key) {
          logger.info('You are already logged in to Carver');
          logger.info('To log in with a different key, use --force or --key options');
          return;
        }
        
        // Get API key from options or prompt
        let apiKey = options.key || process.env.CARVER_API_KEY;
        
        if (!apiKey) {
          // Prompt for API key
          apiKey = await promptForApiKey();
        }
        
        // Verify API key
        logger.info('Verifying API key...');
        const apiService = new ApiService(apiKey);
        const isKeyValid = await apiService.verifyApiKey();
        
        if (!isKeyValid) {
          logger.error('Invalid API key. Please check your credentials.');
          process.exit(1);
        }
        
        // Store API key
        await credentialService.storeApiKey(apiKey);
        
        logger.info('Successfully logged in to Carver');
        logger.info('Your API key has been securely stored in your system keychain');
        logger.info('You can now use Carver commands without specifying your API key');
      } catch (error) {
        logger.error('Login failed:', error);
        process.exit(1);
      }
    });
}

/**
 * Prompt user for API key
 * @returns Promise that resolves with API key
 */
function promptForApiKey(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question('Enter your Carver API key: ', (key) => {
      rl.close();
      resolve(key.trim());
    });
  });
}
