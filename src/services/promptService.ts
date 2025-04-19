import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Handlebars from 'handlebars';
import { ApiService } from './api';
import { logger } from '../utils/logger';
import { getTemplate, getTemplateNames } from '../templates';
import { ConfigService } from './configService';

// Maximum token sizes by AI system
const MAX_TOKENS = {
  default: 8000, // Default maximum token count
  openai: 16000, // GPT-4 Turbo
  anthropic: 100000, // Claude 3
  // Add other AI systems as needed
};

// Approximate characters per token (for estimation)
const CHARS_PER_TOKEN = 4;

export interface PromptOptions {
  projectId: string;
  templateName?: string;
  filePath?: string;
  contextFiles?: string[];
  taskDescription?: string;
  additionalContext?: Record<string, any>;
  maxTokens?: number;
  aiSystem?: 'default' | 'openai' | 'anthropic';
  previewMode?: boolean;
}

export interface ContextFile {
  path: string;
  content: string;
  language: string;
  isRelevant: boolean;
  relevanceScore?: number;
}

/**
 * Service for generating context-rich prompts for AI assistants
 */
export class PromptService {
  private apiService: ApiService;
  private configService: ConfigService;
  private projectRoot: string;

  constructor(apiService: ApiService, configService: ConfigService, projectRoot: string) {
    this.apiService = apiService;
    this.configService = configService;
    this.projectRoot = projectRoot;

    // Register Handlebars helpers
    this.registerHandlebarsHelpers();
  }

  /**
   * Register custom Handlebars helpers for templates
   */
  private registerHandlebarsHelpers(): void {
    // Format code with language identifier
    Handlebars.registerHelper('codeBlock', (content: string, language: string) => {
      if (!content) return '';
      return new Handlebars.SafeString(
        `\`\`\`${language}\n${content.replace(/`/g, '\\`')}\n\`\`\``,
      );
    });

    // Truncate text to a maximum length with ellipsis
    Handlebars.registerHelper('truncate', (text: string, length: number) => {
      if (!text) return '';
      if (text.length <= length) return text;
      return text.substring(0, length) + '...';
    });

    // Format a file path
    Handlebars.registerHelper('filePath', (filePath: string) => {
      if (!filePath) return '';
      // Convert to relative path if absolute
      if (path.isAbsolute(filePath)) {
        try {
          const relativePath = path.relative(this.projectRoot, filePath);
          return relativePath.replace(/\\/g, '/'); // Normalize for display
        } catch (e) {
          return filePath.replace(/\\/g, '/');
        }
      }
      return filePath.replace(/\\/g, '/');
    });

    // Get file extension without dot
    Handlebars.registerHelper('fileExt', (filePath: string) => {
      if (!filePath) return '';
      return path.extname(filePath).replace('.', '');
    });

    // Format date
    Handlebars.registerHelper('formatDate', (date: Date | string | undefined = new Date()) => {
      const d = typeof date === 'string' ? new Date(date) : date || new Date();
      return d.toISOString().split('T')[0];
    });
  }

  /**
   * Generate a context-rich prompt for AI assistants
   * @param options Prompt generation options
   * @returns Generated prompt
   */
  async generatePrompt(options: PromptOptions): Promise<string> {
    const {
      projectId,
      templateName = 'default',
      filePath,
      contextFiles = [],
      taskDescription,
      additionalContext = {},
      maxTokens = MAX_TOKENS[options.aiSystem || 'default'],
      previewMode = false,
    } = options;

    logger.debug(`Generating prompt using template ${templateName}`);

    try {
      // Get project info from config
      const config = this.configService.getConfig();
      const projectName = config?.name || path.basename(this.projectRoot);

      // 1. Gather context files
      const context = await this.gatherContext(filePath, contextFiles, maxTokens);

      // 2. Get the requested template
      const template = getTemplate(templateName);

      // 3. Prepare template variables
      const templateVars = {
        projectName,
        taskDescription: taskDescription || 'No task description provided',
        date: new Date(),
        user: os.userInfo().username,
        context: this.formatContext(context),
        contextFiles: context, // For advanced templates that want to format context themselves
        ...additionalContext,
      };

      // 4. Compile the template
      const compiledTemplate = Handlebars.compile(template);
      const prompt = compiledTemplate(templateVars);

      // 5. If not in preview mode, store the generated prompt in API
      if (!previewMode) {
        try {
          await this.apiService.generatePrompt({
            projectId,
            template: templateName,
            context: {
              prompt,
              originalContext: context.map((file) => ({
                path: file.path,
                isRelevant: file.isRelevant,
                relevanceScore: file.relevanceScore,
              })),
              ...additionalContext,
            },
          });
          logger.debug('Prompt stored in API');
        } catch (error) {
          logger.warn('Failed to store prompt in API:', error);
          // Continue even if API storage fails
        }
      }

      return prompt;
    } catch (error) {
      logger.error('Failed to generate prompt:', error);
      throw new Error('Failed to generate prompt. See logs for details.');
    }
  }

  /**
   * Gather context information for the prompt
   * @param mainFilePath Main file path
   * @param additionalFiles Additional context files
   * @param maxTokens Maximum token limit
   * @returns Prepared context files
   */
  private async gatherContext(
    mainFilePath?: string,
    additionalFiles: string[] = [],
    maxTokens: number = MAX_TOKENS.default,
  ): Promise<ContextFile[]> {
    const contextFiles: ContextFile[] = [];
    const allFiles = [...(mainFilePath ? [mainFilePath] : []), ...additionalFiles];

    // Calculate available character budget
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    let usedChars = 0;

    // Process files
    for (const filePath of allFiles) {
      try {
        // Skip if file doesn't exist
        if (!fs.existsSync(filePath)) {
          logger.warn(`Context file not found: ${filePath}`);
          continue;
        }

        // Read file content
        const content = fs.readFileSync(filePath, 'utf-8');
        const extension = path.extname(filePath).substring(1) || 'txt';

        // Determine relevance (main file is always relevant)
        const isMainFile = filePath === mainFilePath;

        // Add to context with relevance information
        contextFiles.push({
          path: filePath,
          content: content,
          language: extension,
          isRelevant: isMainFile || true, // For now all specified files are considered relevant
          relevanceScore: isMainFile ? 1.0 : 0.8, // Main file gets highest relevance score
        });

        usedChars += content.length;
      } catch (error) {
        logger.error(`Failed to process context file ${filePath}:`, error);
      }
    }

    // If over budget, intelligently truncate
    if (usedChars > maxChars) {
      this.truncateContextToFit(contextFiles, maxChars);
    }

    // Sort by relevance
    return contextFiles.sort((a, b) => {
      if (a.path === mainFilePath) return -1;
      if (b.path === mainFilePath) return 1;
      return (b.relevanceScore || 0) - (a.relevanceScore || 0);
    });
  }

  /**
   * Intelligently truncate context to fit within token limits
   * @param files Context files
   * @param maxChars Maximum characters
   */
  private truncateContextToFit(files: ContextFile[], maxChars: number): void {
    // Sort by relevance
    files.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // First pass: completely remove least relevant files if needed
    let currentTotal = files.reduce((total, file) => total + file.content.length, 0);
    let i = files.length - 1;

    while (currentTotal > maxChars && i > 0) {
      // Don't remove main file or files with high relevance
      if (files[i].relevanceScore && (files[i].relevanceScore ?? 0) < 0.5) {
        currentTotal -= files[i].content.length;
        files.splice(i, 1);
      }
      i--;
    }

    // Second pass: truncate content
    if (currentTotal > maxChars) {
      // Calculate how much we need to remove
      const excess = currentTotal - maxChars;

      // Calculate proportional reduction for each file based on size and relevance
      const totalWeight = files.reduce(
        (sum, file) => sum + file.content.length * (1 - (file.relevanceScore || 0.5)),
        0,
      );

      // Apply truncation
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const weight = (file.content.length * (1 - (file.relevanceScore || 0.5))) / totalWeight;
        const charsToRemove = Math.floor(excess * weight);

        if (charsToRemove > 0 && file.content.length > charsToRemove) {
          // Truncate from the middle to preserve start and end
          const keepStart = Math.floor((file.content.length - charsToRemove) * 0.6);
          const keepEnd = file.content.length - charsToRemove - keepStart;

          file.content =
            file.content.substring(0, keepStart) +
            `\n\n... [${Math.floor(charsToRemove / CHARS_PER_TOKEN)} tokens truncated] ...\n\n` +
            file.content.substring(file.content.length - keepEnd);
        }
      }
    }
  }

  /**
   * Format collected context files for inclusion in the prompt
   * @param files Context files
   * @returns Formatted context string
   */
  private formatContext(files: ContextFile[]): string {
    if (files.length === 0) {
      return 'No context files provided.';
    }

    let result = '## Project Context\n\nRelevant files for this task:\n\n';

    // Add file listing
    files.forEach((file) => {
      const relativePath = path.relative(this.projectRoot, file.path).replace(/\\/g, '/');
      result += `- ${relativePath}\n`;
    });

    result += '\n## File Contents\n\n';

    // Add file contents with syntax highlighting
    files.forEach((file) => {
      const relativePath = path.relative(this.projectRoot, file.path).replace(/\\/g, '/');
      result += `### ${relativePath}\n\n`;
      result += '```' + file.language + '\n';
      result += file.content;
      result += '\n```\n\n';
    });

    return result;
  }

  /**
   * Get available templates
   * @returns List of template names
   */
  getAvailableTemplates(): string[] {
    return getTemplateNames();
  }

  /**
   * Copy prompt to clipboard
   * @param prompt The prompt to copy
   * @returns True if successful
   */
  copyToClipboard(prompt: string): boolean {
    try {
      const { clipboard } = require('clipboardy');
      clipboard.writeSync(prompt);
      return true;
    } catch (error) {
      logger.error('Failed to copy to clipboard:', error);
      return false;
    }
  }
}
