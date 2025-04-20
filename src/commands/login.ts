import { Command } from 'commander';
import { prompt } from 'enquirer';
import * as fs from 'fs-extra';
import * as path from 'path';
import { AuthService } from '../services/auth';
import { ApiService } from '../services/api';
import { logger } from '../utils/logger';
import { getConfig, updateConfig } from '../utils/config';

interface PromptSelectResponse {
  method: string;
}

interface PromptApiKeyResponse {
  apiKey: string;
}

interface PromptKeyIdResponse {
  keyId: string;
}

interface PromptConfirmResponse {
  setDefault: boolean;
}

interface PromptNumberResponse {
  projectIndex: number;
}

/**
 * Create and configure the login command
 */
export function createLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Log in to Carver API')
    .option('--api-key <key>', 'Use API key for authentication')
    .option('--key-id <id>', 'Key ID for private key authentication')
    .action(async (options) => {
      try {
        // Initialize services
        const authService = new AuthService();

        let success = false;

        if (options.apiKey) {
          // Authenticate with provided API key
          logger.info('Authenticating with API key...');
          success = await authService.authenticateWithApiKey(options.apiKey);
        } else {
          // Interactive authentication
          logger.info('Please authenticate with Carver');

          // Ask for authentication method
          const { method } = await prompt<PromptSelectResponse>({
            type: 'select',
            name: 'method',
            message: 'Choose authentication method:',
            choices: ['API Key'],
          });

          if (method === 'API Key') {
            // Get API key from user
            const { apiKey } = await prompt<PromptApiKeyResponse>({
              type: 'password',
              name: 'apiKey',
              message: 'Enter your API key:',
            });

            success = await authService.authenticateWithApiKey(apiKey);
          }
        }

        if (success) {
          logger.info('Authentication successful');

          // Initialize API service to test connection
          const apiService = new ApiService(authService);

          // Verify connection and get version info
          const isConnected = await apiService.validateConnection();
          if (!isConnected) {
            logger.warn(
              'Authenticated but unable to connect to API. Check your network connection.',
            );
          } else {
            // Check version compatibility
            const compatibility = await apiService.checkVersionCompatibility();
            if (!compatibility.compatible) {
              logger.warn(
                `Your CLI version may not be fully compatible with the API. Recommended version range: ${compatibility.minVersion} - ${compatibility.maxVersion}`,
              );
            }

            // Get projects if connected
            try {
              const projects = await apiService.listProjects();

              if (projects.length > 0) {
                logger.info(`Found ${projects.length} projects:`);
                projects.forEach((project, index) => {
                  logger.info(`  ${index + 1}. ${project.name} (${project.id})`);
                });

                // Ask to set default project
                const { setDefault } = await prompt<PromptConfirmResponse>({
                  type: 'confirm',
                  name: 'setDefault',
                  message: 'Do you want to set a default project?',
                  initial: true,
                });

                if (setDefault) {
                  const { projectIndex } = await prompt<PromptNumberResponse>({
                    type: 'number',
                    name: 'projectIndex',
                    message: 'Enter project number:',
                    initial: 1,
                  });

                  if (projectIndex < 1 || projectIndex > projects.length) {
                    logger.error(
                      `Invalid project number. Must be between 1 and ${projects.length}`,
                    );
                  } else {
                    const selectedProject = projects[projectIndex - 1];

                    // Update config with default project
                    updateConfig({ defaultProject: selectedProject.id });

                    logger.info(`Default project set to "${selectedProject.name}"`);
                  }
                }
              } else {
                logger.info(
                  'No projects found. You can create a new project with "carver create-project"',
                );
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger.warn('Failed to retrieve projects:', errorMessage);
            }
          }
        } else {
          logger.error('Authentication failed');
          process.exit(1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Login failed:', errorMessage);
        process.exit(1);
      }
    });
}
