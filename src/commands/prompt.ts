import { Command } from 'commander';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/configService';
import { ApiService } from '../services/api';
import { PromptService } from '../services/promptService';

export function registerPromptCommand(program: Command): void {
  program
    .command('prompt')
    .description('Generate a context-aware prompt')
    .option('-d, --directory <path>', 'Project directory', process.cwd())
    .option('-t, --template <name>', 'Prompt template name')
    .option('-f, --file <path>', 'Target file for context')
    .action(async (options) => {
      try {
        logger.info('Generating prompt...');
        
        const configService = new ConfigService(options.directory);
        const config = configService.getConfig();
        
        if (!config) {
          logger.error('No Carver project found in this directory. Run `carver init` first.');
          process.exit(1);
        }
        
        const apiService = new ApiService(config.apiKey);
        const promptService = new PromptService(apiService);
        
        const prompt = await promptService.generatePrompt({
          projectId: config.projectId,
          template: options.template,
          filePath: options.file
        });
        
        // Display the generated prompt
        console.log('\nGenerated Prompt:');
        console.log('----------------');
        console.log(prompt);
        console.log('----------------');
      } catch (error) {
        logger.error('Failed to generate prompt:', error);
        process.exit(1);
      }
    });
}
