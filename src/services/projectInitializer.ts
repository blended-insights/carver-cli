import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ConfigService } from './configService';
import { ApiService } from './api';

export class ProjectInitializer {
  /**
   * Initialize a new Carver project
   * @param options Initialization options
   */
  async initialize(options: {
    key?: string,
    project?: string,
    directory: string
  }): Promise<void> {
    const { key, project, directory } = options;
    
    // Validate options
    if (!key) {
      throw new Error('API key is required. Use --key option or set CARVER_API_KEY environment variable.');
    }
    
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }
    
    // Check if project is already initialized
    const configService = new ConfigService(directory);
    if (configService.isInitialized()) {
      throw new Error('Project is already initialized. Use --force to reinitialize.');
    }
    
    // Initialize API service
    const apiService = new ApiService(key);
    
    // Create or get project from API
    let projectId = project;
    if (!projectId) {
      logger.info('No project ID provided, creating a new project...');
      const result = await this.createProject(apiService, directory);
      projectId = result.id;
      logger.info(`Created new project with ID: ${projectId}`);
    } else {
      // Verify project exists
      try {
        await apiService.getProjectStatus(projectId);
        logger.info(`Using existing project with ID: ${projectId}`);
      } catch (error) {
        throw new Error(`Project not found or access denied: ${projectId}`);
      }
    }
    
    // Save configuration
    const config = {
      projectId,
      apiKey: key,
      lastSync: new Date().toISOString()
    };
    
    configService.saveConfig(config);
    
    // Create .carver directory with README
    const carverDir = path.join(directory, '.carver');
    if (!fs.existsSync(carverDir)) {
      fs.mkdirSync(carverDir, { recursive: true });
    }
    
    const readmePath = path.join(carverDir, 'README.md');
    fs.writeFileSync(readmePath, `# Carver Project
    
This directory contains Carver configuration files. Do not edit these files directly.

Project ID: ${projectId}
Initialized: ${new Date().toISOString()}
`);
    
    // Add .carver to .gitignore if not already there
    this.updateGitignore(directory);
    
    logger.info('Project initialized successfully');
  }
  
  /**
   * Create a new project on the API
   * @param apiService API service instance
   * @param directory Project directory
   * @returns Created project
   */
  private async createProject(apiService: ApiService, directory: string): Promise<any> {
    // Get project name from directory
    const projectName = path.basename(directory);
    
    try {
      const project = await apiService.createProject({
        name: projectName,
        description: `Project created via Carver CLI on ${new Date().toISOString()}`
      });
      
      return project;
    } catch (error) {
      throw new Error(`Failed to create project: ${error}`);
    }
  }
  
  /**
   * Update .gitignore file to include .carver directory
   * @param directory Project directory
   */
  private updateGitignore(directory: string): void {
    const gitignorePath = path.join(directory, '.gitignore');
    const carverPattern = '.carver/';
    
    try {
      let content = '';
      
      // Read existing .gitignore if it exists
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf-8');
        
        // Check if .carver/ is already in .gitignore
        if (content.includes(carverPattern)) {
          return;
        }
        
        // Add a newline if the file doesn't end with one
        if (content && !content.endsWith('\n')) {
          content += '\n';
        }
      }
      
      // Add .carver/ pattern
      content += `# Carver CLI configuration\n${carverPattern}\n`;
      
      // Write updated .gitignore
      fs.writeFileSync(gitignorePath, content);
      logger.debug('Updated .gitignore file');
    } catch (error) {
      logger.warn('Failed to update .gitignore file:', error);
    }
  }
}
