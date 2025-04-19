/* eslint-disable no-console */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/configService';
import { ApiService } from '../services/api';
import { PromptService } from '../services/promptService';
import { CredentialService } from '../services/credentialService';
import { AuthService } from '../services/auth';

interface PromptOptions {
  directory: string;
  file?: string;
  template?: string;
  context?: string[];
  task?: string;
  output?: string;
  clipboard?: boolean;
  list?: boolean;
  preview?: boolean;
  maxTokens?: number;
  aiSystem?: 'default' | 'openai' | 'anthropic';
}

export function registerPromptCommand(program: Command): void {
  program
    .command('prompt')
    .description('Generate an AI prompt for your code')
    .option('-d, --directory <path>', 'Project directory', process.cwd())
    .option('-f, --file <path>', 'Main file for the prompt (target of changes)')
    .option('-t, --template <name>', 'Prompt template to use (default, feature, bugfix, etc)')
    .option('-c, --context <paths...>', 'Additional files to include in context')
    .option('--task <description>', 'Brief description of the development task')
    .option('-o, --output <path>', 'Output file for the prompt')
    .option('--clipboard', 'Copy the prompt to clipboard', false)
    .option('-l, --list', 'List available templates', false)
    .option('--preview', 'Preview the prompt without saving to API', false)
    .option('--max-tokens <number>', 'Maximum tokens for the prompt')
    .option('--ai-system <system>', 'Target AI system (default, openai, anthropic)')
    .action(async (options: PromptOptions) => {
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
          logger.error(`Project is not initialized in ${directory}. Run "carver init" first.`);
          process.exit(1);
        }

        // Get project configuration
        const config = configService.getConfig();
        if (!config || !config.projectId) {
          logger.error('Invalid project configuration');
          process.exit(1);
        }

        // Get credentials
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

        // Initialize services
        const authService = new AuthService();
        const apiService = new ApiService(authService);
        const promptService = new PromptService(apiService, configService, directory);

        // List templates if requested
        if (options.list) {
          const localTemplates = promptService.getAvailableTemplates();

          console.log('\nAvailable templates:');
          if (localTemplates.length === 0) {
            console.log('  No templates available');
          } else {
            localTemplates.forEach((template) => {
              console.log(`  - ${template}`);
            });
          }

          // Also check for remote templates
          try {
            logger.info('Fetching remote templates...');
            const remoteTemplates = await apiService.getTemplates(config.projectId);

            if (remoteTemplates.length > 0) {
              console.log('\nRemote templates:');
              remoteTemplates
                .filter((t) => !localTemplates.includes(t))
                .forEach((template) => {
                  console.log(`  - ${template} (remote)`);
                });
            }
          } catch (error) {
            logger.debug('Failed to fetch remote templates:', error);
          }

          console.log('\nUse with: carver prompt -t <template_name>');
          return;
        }

        // Normalize file path if provided
        let filePath: string | undefined;
        if (options.file) {
          filePath = path.resolve(directory, options.file);

          if (!fs.existsSync(filePath)) {
            logger.error(`File does not exist: ${filePath}`);
            process.exit(1);
          }
        }

        // Normalize context file paths
        const contextFiles: string[] = [];
        if (options.context && options.context.length > 0) {
          for (const contextPath of options.context) {
            const fullPath = path.resolve(directory, contextPath);
            if (fs.existsSync(fullPath)) {
              contextFiles.push(fullPath);
            } else {
              logger.warn(`Context file not found, skipping: ${contextPath}`);
            }
          }
        }

        // Generate prompt
        logger.info('Generating prompt...');
        try {
          const prompt = await promptService.generatePrompt({
            projectId: config.projectId,
            templateName: options.template,
            filePath,
            contextFiles,
            taskDescription: options.task,
            maxTokens: options.maxTokens ? parseInt(options.maxTokens.toString()) : undefined,
            aiSystem: options.aiSystem,
            previewMode: options.preview,
          });

          // Output prompt
          if (options.output) {
            const outputPath = path.resolve(options.output);
            fs.writeFileSync(outputPath, prompt);
            logger.info(`Prompt saved to ${outputPath}`);
          }

          // Copy to clipboard if requested
          if (options.clipboard) {
            try {
              const clipboardy = require('clipboardy');
              clipboardy.writeSync(prompt);
              logger.info('Prompt copied to clipboard');
            } catch (error) {
              logger.error('Failed to copy to clipboard:', error);
            }
          }

          // Print preview to console
          if (!options.output || options.preview) {
            console.log('\n=== Generated Prompt ===\n');
            console.log(prompt);
            console.log('\n=========================\n');
          }

          // Show token estimation
          const chars = prompt.length;
          const estimatedTokens = Math.ceil(chars / 4);
          console.log(`Estimated tokens: ~${estimatedTokens}`);

          if (options.preview) {
            console.log('Preview mode: Prompt was not saved to API');
          }
        } catch (error) {
          logger.error('Failed to generate prompt:', error);
          process.exit(1);
        }
      } catch (error) {
        logger.error('Prompt command failed:', error);
        process.exit(1);
      }
    });
}
