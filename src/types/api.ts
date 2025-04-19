/**
 * API response for project creation
 */
export interface CreateProjectResponse {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

/**
 * API response for project status
 */
export interface ProjectStatusResponse {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  fileCount: number;
  lastSync: string;
}

/**
 * API response for file update
 */
export interface FileUpdateResponse {
  path: string;
  status: 'success' | 'error';
  message?: string;
  timestamp: string;
}

/**
 * API response for file deletion
 */
export interface FileDeleteResponse {
  path: string;
  status: 'success' | 'error';
  message?: string;
  timestamp: string;
}

/**
 * API response for prompt generation
 */
export interface PromptGenerationResponse {
  prompt: string;
  template: string;
  timestamp: string;
}

/**
 * API response for templates list
 */
export interface TemplatesResponse {
  templates: string[];
}
