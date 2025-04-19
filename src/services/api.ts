import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { getConfig } from "../utils/config";
import { logger } from "../utils/logger";
import { AuthService } from "./auth";

// Interfaces
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

export interface ApiOptions {
  apiEndpoint?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  batchSize?: number;
  cacheTTL?: number;
}

interface RequestQueueItem {
  config: AxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  retryCount: number;
  timestamp: number;
  priority: number;
}

/**
 * ApiService handles all API communication with the Carver API
 */
export class ApiService {
  private client: AxiosInstance;
  private authService: AuthService;
  private apiKey?: string;
  private requestQueue: RequestQueueItem[] = [];
  private isProcessingQueue = false;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private isOnline = true;
  private circuitOpen = false;
  private failureCount = 0;
  private lastFailureTime = 0;

  // Configuration options
  private retryAttempts: number;
  private retryDelay: number;
  private batchSize: number;
  private cacheTTL: number;

  constructor(authService: AuthService, options?: ApiOptions) {
    this.authService = authService;
    const config = getConfig();

    // Set configuration options
    this.retryAttempts = options?.retryAttempts || 3;
    this.retryDelay = options?.retryDelay || 1000;
    this.batchSize = options?.batchSize || 10;
    this.cacheTTL = options?.cacheTTL || 60000; // 1 minute default

    // Initialize axios client with base configuration
    this.client = axios.create({
      baseURL: options?.apiEndpoint || config.apiEndpoint,
      timeout: options?.timeout || config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": `carver-cli/${config.version || "1.0.0"}`,
      },
    });

    // Add request interceptor for auth and logging
    this.client.interceptors.request.use(async (request) => {
      // Add auth headers to request
      const authHeaders = await this.authService.getAuthHeaders();
      // Use spread operator with type assertion to fix the TypeScript error
      request.headers = {
        ...(request.headers as Record<string, string>),
        ...authHeaders,
      } as typeof request.headers;

      const method = request.method?.toUpperCase() || "UNKNOWN";
      const url = request.url || "UNKNOWN";
      logger.debug(`API Request: ${method} ${url}`);
      return request;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.statusText}`);
        // Reset failure count on success
        this.failureCount = 0;
        this.circuitOpen = false;
        return response;
      },
      async (error) => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} ${error.response.statusText}`);
          logger.debug("API Error Details:", error.response.data);

          // Handle specific status codes
          if (error.response.status === 401 || error.response.status === 403) {
            // Authentication error - token may have expired
            logger.debug("Authentication error detected, attemping to refresh token");
            // This will be handled by the retry mechanism
          }

          if (error.response.status === 429) {
            // Rate limiting - adjust retry delay
            const retryAfter = error.response.headers["retry-after"];
            if (retryAfter) {
              const retryDelay = parseInt(retryAfter, 10) * 1000;
              error.retryDelay = retryDelay;
              logger.debug(`Rate limit hit, retry after ${retryDelay}ms`);
            }
          }

          // Update circuit breaker status
          this.updateCircuitBreakerStatus(error);
        } else if (error.request) {
          logger.error("API Error: No response received");
          // Network error - we might be offline
          this.isOnline = false;
          error.isNetworkError = true;
        } else {
          logger.error("API Error:", error.message);
        }

        return Promise.reject(error);
      },
    );

    // Start network status check
    this.startNetworkStatusCheck();
  }

  /**
   * Update circuit breaker status based on failures
   */
  private updateCircuitBreakerStatus(error: any): void {
    const now = Date.now();
    this.failureCount++;
    this.lastFailureTime = now;

    // Open the circuit if too many failures occur
    if (this.failureCount >= 5 && !this.circuitOpen) {
      this.circuitOpen = true;
      logger.warn("Circuit breaker opened due to multiple API failures");

      // Auto-reset circuit after 30 seconds
      setTimeout(() => {
        logger.info("Circuit breaker reset, attempting to resume normal operations");
        this.circuitOpen = false;
        this.failureCount = 0;
      }, 30000);
    }
  }

  /**
   * Start periodic network status check
   */
  private startNetworkStatusCheck(): void {
    setInterval(async () => {
      if (!this.isOnline) {
        try {
          const response = await fetch(this.client.defaults.baseURL + "/healthcheck");
          this.isOnline = response.ok;

          if (this.isOnline) {
            logger.info("Network connection restored, processing queued requests");
            this.processRequestQueue();
          }
        } catch (error) {
          // Still offline
          this.isOnline = false;
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Execute a request with retry logic
   * @param config Request configuration
   * @param priority Request priority (higher number = higher priority)
   * @returns Promise with the response
   */
  private async executeRequest<T>(config: AxiosRequestConfig, priority = 1): Promise<T> {
    // Check cache for GET requests
    if (config.method?.toLowerCase() === "get" && config.url) {
      const cacheKey = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
      const cachedItem = this.cache.get(cacheKey);

      if (cachedItem && Date.now() - cachedItem.timestamp < this.cacheTTL) {
        logger.debug(`Using cached response for ${config.url}`);
        return cachedItem.data;
      }
    }

    // Check if we're offline or circuit is open
    if (!this.isOnline || this.circuitOpen) {
      return new Promise<T>((resolve, reject) => {
        logger.debug(`Queueing request to ${config.url} (offline or circuit open)`);
        this.requestQueue.push({
          config,
          resolve,
          reject,
          retryCount: 0,
          timestamp: Date.now(),
          priority,
        });
      });
    }

    // Execute the request with retries
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.request<T>(config);

        // Cache GET responses
        if (config.method?.toLowerCase() === "get" && config.url) {
          const cacheKey = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
          this.cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now(),
          });
        }

        return response.data;
      } catch (error: any) {
        // Don't retry if we're intentionally cancelling
        if (axios.isCancel(error)) {
          throw error;
        }

        const isLastAttempt = attempt === this.retryAttempts;

        // Don't retry certain error types
        if (error.response) {
          // Don't retry 4xx errors except 401 (auth) and 429 (rate limit)
          const status = error.response.status;
          if (status >= 400 && status < 500 && status !== 401 && status !== 429) {
            throw error;
          }

          // For 401 errors, try to refresh the token before retrying
          if (status === 401 && attempt === 0) {
            try {
              await this.authService.refreshAccessToken();
              // Continue to retry after token refresh
            } catch (refreshError) {
              logger.error("Failed to refresh token:", refreshError);
              throw error; // If refresh fails, don't retry
            }
          }
        }

        if (isLastAttempt) {
          // If we're offline, queue the request instead of failing
          if (error.isNetworkError) {
            this.isOnline = false;
            return new Promise<T>((resolve, reject) => {
              logger.debug(`Queueing request to ${config.url} after network error`);
              this.requestQueue.push({
                config,
                resolve,
                reject,
                retryCount: 0,
                timestamp: Date.now(),
                priority,
              });
            });
          }

          throw error;
        }

        // Calculate exponential backoff delay
        let delayMs = error.retryDelay || this.retryDelay * Math.pow(2, attempt);

        // Add some jitter (±20%)
        delayMs = delayMs * (0.8 + Math.random() * 0.4);

        logger.debug(
          `Retrying request to ${config.url} (attempt ${attempt + 1}/${this.retryAttempts}) after ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // This should never be reached due to the loop above
    throw new Error("Request failed after maximum retries");
  }

  /**
   * Process the request queue
   */
  private async processRequestQueue(): Promise<void> {
    if (
      this.isProcessingQueue ||
      this.requestQueue.length === 0 ||
      !this.isOnline ||
      this.circuitOpen
    ) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Sort queue by priority (highest first) and then by timestamp (oldest first)
      this.requestQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Process requests in batches
      while (this.requestQueue.length > 0 && this.isOnline && !this.circuitOpen) {
        // Take a batch from the front of the queue
        const batch = this.requestQueue.splice(0, this.batchSize);

        // Process batch in parallel
        await Promise.all(
          batch.map(async (item) => {
            try {
              const response = await this.client.request(item.config);
              item.resolve(response.data);
            } catch (error: any) {
              // If we need to retry (network error or certain status codes)
              if (
                (error.isNetworkError ||
                  (error.response &&
                    (error.response.status === 429 || error.response.status >= 500))) &&
                item.retryCount < this.retryAttempts
              ) {
                // Put back in queue with increased retry count
                item.retryCount++;
                this.requestQueue.push(item);
              } else {
                // Permanent failure
                item.reject(error);
              }
            }
          }),
        );
      }
    } finally {
      this.isProcessingQueue = false;

      // If there are still items in the queue, continue processing
      if (this.requestQueue.length > 0 && this.isOnline && !this.circuitOpen) {
        this.processRequestQueue();
      }
    }
  }

  /**
   * Clear the request cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug("API cache cleared");
  }

  /**
   * Verify API key is valid
   * @returns Promise resolving to boolean indicating if key is valid
   */
  async verifyApiKey(): Promise<boolean> {
    try {
      const response = await this.executeRequest<any>(
        {
          method: "get",
          url: "/auth/verify",
        },
        10,
      ); // High priority

      return !!response;
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
    return this.executeRequest<ProjectInfo>({
      method: "get",
      url: `/projects/${projectId}`,
    });
  }

  /**
   * Get project status
   * @param projectId Project ID
   * @returns Project status
   */
  async getProjectStatus(projectId: string): Promise<any> {
    return this.executeRequest<any>({
      method: "get",
      url: `/projects/${projectId}/status`,
    });
  }

  /**
   * List all projects
   * @returns Array of projects
   */
  async listProjects(): Promise<ProjectInfo[]> {
    const response = await this.executeRequest<{ projects: ProjectInfo[] }>({
      method: "get",
      url: "/projects",
    });

    return response.projects || [];
  }

  /**
   * Create a new project
   * @param params Project creation parameters
   * @returns Created project
   */
  async createProject(params: { name: string; description?: string }): Promise<ProjectInfo> {
    return this.executeRequest<ProjectInfo>(
      {
        method: "post",
        url: "/projects",
        data: params,
      },
      5,
    ); // Higher priority
  }

  /**
   * Update project details
   * @param projectId Project ID
   * @param params Project update parameters
   * @returns Updated project
   */
  async updateProject(
    projectId: string,
    params: {
      name?: string;
      description?: string;
    },
  ): Promise<ProjectInfo> {
    return this.executeRequest<ProjectInfo>({
      method: "put",
      url: `/projects/${projectId}`,
      data: params,
    });
  }

  /**
   * Delete a project
   * @param projectId Project ID
   * @returns Success indicator
   */
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      await this.executeRequest<any>(
        {
          method: "delete",
          url: `/projects/${projectId}`,
        },
        5,
      ); // Higher priority

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update file in the project
   * @param projectId Project ID
   * @param filePath File path
   * @param content File content (string or Buffer)
   * @returns Update result
   */
  async updateFile(projectId: string, filePath: string, content: string | Buffer): Promise<any> {
    // Convert Buffer to base64 string if needed
    const contentValue = Buffer.isBuffer(content) ? content.toString("base64") : content;
    const isBase64 = Buffer.isBuffer(content);

    return this.executeRequest<any>(
      {
        method: "post",
        url: `/projects/${projectId}/files`,
        data: {
          path: filePath,
          content: contentValue,
          encoding: isBase64 ? "base64" : "utf8",
        },
      },
      3,
    ); // Medium priority
  }

  /**
   * Batch update multiple files
   * @param projectId Project ID
   * @param files Array of files to update
   * @returns Update result
   */
  async updateFiles(
    projectId: string,
    files: Array<{ path: string; content: string | Buffer }>,
  ): Promise<any> {
    // Process files to handle binary content
    const processedFiles = files.map((file) => {
      if (Buffer.isBuffer(file.content)) {
        return {
          path: file.path,
          content: file.content.toString("base64"),
          encoding: "base64",
        };
      } else {
        return {
          path: file.path,
          content: file.content,
          encoding: "utf8",
        };
      }
    });

    return this.executeRequest<any>(
      {
        method: "post",
        url: `/projects/${projectId}/files/batch`,
        data: {
          files: processedFiles,
        },
      },
      3,
    ); // Medium priority
  }

  /**
   * Get file content
   * @param projectId Project ID
   * @param filePath File path
   * @returns File content
   */
  async getFile(projectId: string, filePath: string): Promise<string> {
    const response = await this.executeRequest<{ content: string }>({
      method: "get",
      url: `/projects/${projectId}/files`,
      params: { path: filePath },
    });

    return response.content;
  }

  /**
   * Delete file from the project
   * @param projectId Project ID
   * @param filePath File path
   * @returns Delete result
   */
  async deleteFile(projectId: string, filePath: string): Promise<any> {
    return this.executeRequest<any>({
      method: "delete",
      url: `/projects/${projectId}/files`,
      data: {
        path: filePath,
      },
    });
  }

  /**
   * List project files
   * @param projectId Project ID
   * @param directory Optional subdirectory to list
   * @returns Array of file stats
   */
  async listFiles(projectId: string, directory?: string): Promise<FileStats[]> {
    const response = await this.executeRequest<{ files: FileStats[] }>({
      method: "get",
      url: `/projects/${projectId}/files/list`,
      params: directory ? { directory } : {},
    });

    return response.files || [];
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
    const response = await this.executeRequest<{ prompt: string }>(
      {
        method: "post",
        url: `/projects/${params.projectId}/prompt`,
        data: params,
      },
      7,
    ); // High priority

    return response.prompt;
  }

  /**
   * Get available templates for a project
   * @param projectId Project ID
   * @returns List of available templates
   */
  async getTemplates(projectId: string): Promise<string[]> {
    const response = await this.executeRequest<{ templates: string[] }>({
      method: "get",
      url: `/projects/${projectId}/templates`,
    });

    return response.templates;
  }

  /**
   * Sync project status
   * @param projectId Project ID
   * @returns Sync status
   */
  async syncProject(projectId: string): Promise<any> {
    return this.executeRequest<any>(
      {
        method: "post",
        url: `/projects/${projectId}/sync`,
      },
      5,
    ); // Higher priority
  }

  /**
   * Get project statistics
   * @param projectId Project ID
   * @returns Project statistics
   */
  async getProjectStats(projectId: string): Promise<any> {
    return this.executeRequest<any>({
      method: "get",
      url: `/projects/${projectId}/stats`,
    });
  }

  /**
   * Upload file to the project
   * @param projectId Project ID
   * @param filePath Local file path
   * @param remotePath Remote path to save the file
   * @returns Upload result
   */
  async uploadFile(projectId: string, filePath: string, remotePath: string): Promise<any> {
    // This would typically use a FormData approach with actual file upload
    // For now, we'll use a simplified version
    return this.executeRequest<any>(
      {
        method: "post",
        url: `/projects/${projectId}/files/upload`,
        data: {
          path: remotePath,
          localPath: filePath,
        },
      },
      4,
    ); // Higher priority due to size
  }

  /**
   * Download file from the project
   * @param projectId Project ID
   * @param remotePath Remote file path
   * @param localPath Local path to save the file
   * @returns Download result
   */
  async downloadFile(projectId: string, remotePath: string, localPath: string): Promise<any> {
    return this.executeRequest<any>(
      {
        method: "get",
        url: `/projects/${projectId}/files/download`,
        params: {
          path: remotePath,
          localPath: localPath,
        },
        responseType: "stream",
      },
      4,
    ); // Higher priority
  }

  /**
   * Check API version compatibility
   * @returns Compatibility information
   */
  async checkVersionCompatibility(): Promise<{
    compatible: boolean;
    minVersion: string;
    maxVersion: string;
  }> {
    try {
      const config = getConfig();
      const clientVersion = config.version || "1.0.0";

      const response = await this.executeRequest<any>(
        {
          method: "get",
          url: "/compatibility",
          params: {
            clientVersion,
          },
        },
        10,
      ); // Highest priority

      return {
        compatible: response.compatible || false,
        minVersion: response.minVersion || "0.0.0",
        maxVersion: response.maxVersion || "999.999.999",
      };
    } catch (error) {
      // Default to compatible on error
      return {
        compatible: true,
        minVersion: "0.0.0",
        maxVersion: "999.999.999",
      };
    }
  }

  /**
   * Validate connection to API
   * @returns Connection status
   */
  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.executeRequest<any>(
        {
          method: "get",
          url: "/healthcheck",
        },
        10,
      ); // Highest priority

      return true;
    } catch (error) {
      return false;
    }
  }
}
