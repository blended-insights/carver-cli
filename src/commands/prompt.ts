/* eslint-disable no-console */

import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../utils/logger";
import { ConfigService } from "../services/configService";
import { ApiService } from "../services/api";
import { CredentialService } from "../services/credentialService";

export function registerPromptCommand(program: Command): void {
  program
    .command("prompt")
    .description("Generate an AI prompt for your code")
    .option("-d, --directory <path>", "Project directory", process.cwd())
    .option("-f, --file <path>", "Target file for the prompt")
    .option("-t, --template <n>", "Prompt template to use")
    .option("-o, --output <path>", "Output file for the prompt")
    .option("-l, --list", "List available templates")
    .option("--context <json>", "Additional context for prompt generation (JSON string)")
    .action(async (options) => {
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
          logger.error("Invalid project configuration");
          process.exit(1);
        }

        // Get API key
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

        // Initialize API service
        const apiService = new ApiService(apiKey);

        // List templates if requested
        if (options.list) {
          logger.info("Fetching available templates...");
          try {
            const templates = await apiService.getTemplates(config.projectId);
            console.log("\nAvailable templates:");
            if (templates.length === 0) {
              console.log("  No templates available");
            } else {
              templates.forEach((template) => {
                console.log(`  - ${template}`);
              });
            }
            console.log("\nUse with: carver prompt -t <template_name>");
            return;
          } catch (error) {
            logger.error("Failed to fetch templates:", error);
            process.exit(1);
          }
        }

        // Validate template
        if (!options.template) {
          logger.error(
            "Template is required. Use --template option or -l to list available templates.",
          );
          process.exit(1);
        }

        // Validate file path if provided
        let relativePath: string | undefined;
        if (options.file) {
          const filePath = path.resolve(directory, options.file);

          if (!fs.existsSync(filePath)) {
            logger.error(`File does not exist: ${filePath}`);
            process.exit(1);
          }

          // Convert to relative path
          relativePath = path.relative(directory, filePath);
        }

        // Parse context if provided
        let context: any = undefined;
        if (options.context) {
          try {
            context = JSON.parse(options.context);
          } catch (error) {
            logger.error("Invalid JSON in context parameter. Must be a valid JSON string.");
            process.exit(1);
          }
        }

        // Generate prompt
        logger.info("Generating prompt...");
        try {
          const prompt = await apiService.generatePrompt({
            projectId: config.projectId,
            template: options.template,
            filePath: relativePath,
            context,
          });

          // Output prompt
          if (options.output) {
            const outputPath = path.resolve(options.output);
            fs.writeFileSync(outputPath, prompt);
            logger.info(`Prompt saved to ${outputPath}`);
          } else {
            // Print to console
            console.log("\n=== Generated Prompt ===\n");
            console.log(prompt);
            console.log("\n=========================\n");
          }
        } catch (error) {
          logger.error("Failed to generate prompt:", error);
          process.exit(1);
        }
      } catch (error) {
        logger.error("Prompt command failed:", error);
        process.exit(1);
      }
    });
}
