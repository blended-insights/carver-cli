import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface FileStats {
  path: string;
  size: number;
  lastModified: string;
  contentType: string;
}

export class ApiService {
  private client: AxiosInstance;
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    const config = getConfig();
    
    // Initialize axios client with base configuration
    this.client = axios.create({
      baseURL: config.apiEndpoint,
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': `carver-cli/${config.version || '1.0.0'}`,
      },
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(request => {
      const method = request.method?.toUpperCase() || 'UNKNOWN';
      const url = request.url || 'UNKNOWN';
      logger.debug(`API Request: ${method} ${url}`);
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
      },
    );
  }
  
  /**
   * Verify API key is valid
   * @returns Promise resolving to boolean indicating if key is valid
   */
  async verifyApiKey(): Promise<boolean> {
    try {
      const response = await this.client.get('/auth/verify');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get project information
   * @param projectId Project ID
   * @returns Project information
   */
  async getProject(projectId: string): Promise<ProjectInfo> {
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data;
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
   * List all projects
   * @returns Array of projects
   */
  async listProjects(): Promise<ProjectInfo[]> {
    const response = await this.client.get('/projects');
    return response.data.projects || [];
  }
  
  /**
   * Create a new project
   * @param params Project creation parameters
   * @returns Created project
   */
  async createProject(params: {
    name: string;
    description?: string;
  }): Promise<ProjectInfo> {
    const response = await this.client.post('/projects', params);
    return response.data;
  }
  
  /**
   * Update project details
   * @param projectId Project ID
   * @param params Project update parameters
   * @returns Updated project
   */
  async updateProject(projectId: string, params: {
    name?: string;
    description?: string;
  }): Promise<ProjectInfo> {
    const response = await this.client.put(`/projects/${projectId}`, params);
    return response.data;
  }
  
  /**
   * Delete a project
   * @param projectId Project ID
   * @returns Success indicator
   */
  async deleteProject(projectId: string): Promise<boolean> {
    const response = await this.client.delete(`/projects/${projectId}`);
    return response.status === 200;
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
      content,
    });
    return response.data;
  }
  
  /**
   * Batch update multiple files
   * @param projectId Project ID
   * @param files Array of files to update
   * @returns Update result
   */
  async updateFiles(projectId: string, files: Array<{ path: string, content: string }>): Promise<any> {
    const response = await this.client.post(`/projects/${projectId}/files/batch`, {
      files,
    });
    return response.data;
  }
  
  /**
   * Get file content
   * @param projectId Project ID
   * @param filePath File path
   * @returns File content
   */
  async getFile(projectId: string, filePath: string): Promise<string> {
    const response = await this.client.get(`/projects/${projectId}/files`, {
      params: { path: filePath },
    });
    return response.data.content;
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
        path: filePath,
      },
    });
    return response.data;
  }
  
  /**
   * List project files
   * @param projectId Project ID
   * @param directory Optional subdirectory to list
   * @returns Array of file stats
   */
  async listFiles(projectId: string, directory?: string): Promise<FileStats[]> {
    const response = await this.client.get(`/projects/${projectId}/files/list`, {
      params: directory ? { directory } : {},
    });
    return response.data.files || [];
  }
  
  /**
   * Generate a prompt
   * @param params Prompt parameters
   * @returns Generated prompt
   */
  async generatePrompt(params: {
    projectId: string;
    template: string;
    filePath?: string;
    context?: any;
  }): Promise<string> {
    const response = await this.client.post(`/projects/${params.projectId}/prompt`, params);
    return response.data.prompt;
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
  
  /**
   * Sync project status
   * @param projectId Project ID
   * @returns Sync status
   */
  async syncProject(projectId: string): Promise<any> {
    const response = await this.client.post(`/projects/${projectId}/sync`);
    return response.data;
  }
  
  /**
   * Get project statistics
   * @param projectId Project ID
   * @returns Project statistics
   */
  async getProjectStats(projectId: string): Promise<any> {
    const response = await this.client.get(`/projects/${projectId}/stats`);
    return response.data;
  }
  
  /**
   * Validate connection to API
   * @returns Connection status
   */
  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/healthcheck');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
