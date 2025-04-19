import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';

export class ApiService {
  private client: AxiosInstance;
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    const config = getConfig();
    
    // Initialize axios client with base configuration
    this.client = axios.create({
      baseURL: config.apiEndpoint,
      timeout: config.timeout,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': `carver-cli/${config.version}`
      }
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(request => {
      logger.debug(`API Request: ${request.method?.toUpperCase()} ${request.url}`);
      return request;
    });
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => {
        logger.debug(`API Response: ${response.status} ${response.statusText}`);
        return response;
      },
      error => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} ${error.response.statusText}`);
          logger.debug('API Error Details:', error.response.data);
        } else if (error.request) {
          logger.error('API Error: No response received');
        } else {
          logger.error('API Error:', error.message);
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Get project status
   * @param projectId Project ID
   * @returns Project status
   */
  async getProjectStatus(projectId: string): Promise<any> {
    const response = await this.client.get(`/projects/${projectId}/status`);
    return response.data;
  }
  
  /**
   * Update file in the project
   * @param projectId Project ID
   * @param filePath File path
   * @param content File content
   * @returns Update result
   */
  async updateFile(projectId: string, filePath: string, content: string): Promise<any> {
    const response = await this.client.post(`/projects/${projectId}/files`, {
      path: filePath,
      content
    });
    return response.data;
  }
  
  /**
   * Delete file from the project
   * @param projectId Project ID
   * @param filePath File path
   * @returns Delete result
   */
  async deleteFile(projectId: string, filePath: string): Promise<any> {
    const response = await this.client.delete(`/projects/${projectId}/files`, {
      data: {
        path: filePath
      }
    });
    return response.data;
  }
  
  /**
   * Generate a prompt
   * @param params Prompt parameters
   * @returns Generated prompt
   */
  async generatePrompt(params: {
    projectId: string,
    template: string,
    filePath?: string,
    context?: any
  }): Promise<string> {
    const response = await this.client.post(`/projects/${params.projectId}/prompt`, params);
    return response.data.prompt;
  }
  
  /**
   * Create a new project
   * @param params Project creation parameters
   * @returns Created project
   */
  async createProject(params: {
    name: string,
    description?: string
  }): Promise<any> {
    const response = await this.client.post('/projects', params);
    return response.data;
  }
  
  /**
   * Get available templates for a project
   * @param projectId Project ID
   * @returns List of available templates
   */
  async getTemplates(projectId: string): Promise<string[]> {
    const response = await this.client.get(`/projects/${projectId}/templates`);
    return response.data.templates;
  }
}
