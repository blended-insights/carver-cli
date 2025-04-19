import { Command } from 'commander';
import { AuthService } from '../services/auth';
import { logger } from '../utils/logger';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Log out from Carver API')
    .action(async () => {
      try {
        // Initialize auth service
        const authService = new AuthService();

        // Check if authenticated
        const isAuthenticated = await authService.isAuthenticated();

        if (!isAuthenticated) {
          logger.info('You are not logged in');
          return;
        }

        // Perform logout
        await authService.logout();

        logger.info('Successfully logged out');
      } catch (error) {
        logger.error('Logout failed:', error);
        process.exit(1);
      }
    });
}
