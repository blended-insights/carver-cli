import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ApiService } from './api';

export class PromptService {
  private apiService: ApiService;
  
  constructor(apiService: ApiService) {
    this.apiService = apiService;
  }
  
  /**
   * Generate a context-aware prompt
   * @param params Prompt parameters
   * @returns Generated prompt
   */
  async generatePrompt(params: {
    projectId: string,
    template?: string,
    filePath?: string,
    context?: any
  }): Promise<string> {
    logger.debug('Generating prompt with parameters:', params);
    
    const { projectId, template, filePath } = params;
    let context = params.context || {};
    
    // If file path is provided, read the file content
    if (filePath) {
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const extension = path.extname(filePath).substring(1);
        const filename = path.basename(filePath);
        
        // Add file context
        context = {
          ...context,
          file: {
            path: filePath,
            name: filename,
            extension,
            content,
          },
        };
        
        logger.debug(`Added file context for ${filename}`);
      } catch (error) {
        logger.error('Failed to read file for context:', error);
      }
    }
    
    // Call API to generate prompt
    try {
      const prompt = await this.apiService.generatePrompt({
        projectId,
        template: template || 'default',
        context,
      });
      
      return prompt;
    } catch (error) {
      logger.error('Failed to generate prompt:', error);
      throw new Error('Failed to generate prompt. See logs for details.');
    }
  }
  
  /**
   * Get available prompt templates
   * @param projectId Project ID
   * @returns List of available templates
   */
  async getTemplates(projectId: string): Promise<string[]> {
    try {
      return await this.apiService.getTemplates(projectId);
    } catch (error) {
      logger.error('Failed to get templates:', error);
      return ['default']; // Return at least the default template
    }
  }
}
