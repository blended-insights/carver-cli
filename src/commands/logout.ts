import { Command } from 'commander';
import { logger } from '../utils/logger';
import { CredentialService } from '../services/credentialService';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Log out and remove stored credentials')
    .option('--all', 'Remove all stored project credentials')
    .action(async (options) => {
      try {
        const credentialService = new CredentialService();
        
        // Delete API key
        const apiKeyDeleted = await credentialService.deleteApiKey();
        
        if (apiKeyDeleted) {
          logger.info('Successfully logged out from Carver');
          logger.info('Your API key has been removed from the system keychain');
        } else {
          logger.info('No stored credentials found');
        }
        
        // Delete all project credentials if requested
        if (options.all) {
          // Note: This feature would require tracking all stored project IDs
          // This is a placeholder for future implementation
          logger.info('Removing project credentials is not yet implemented');
        }
      } catch (error) {
        logger.error('Logout failed:', error);
        process.exit(1);
      }
    });
}
