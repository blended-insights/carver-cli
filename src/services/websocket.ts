import { io, Socket } from 'socket.io-client';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { AuthService } from './auth';
import { EventEmitter } from 'events';

export interface WebSocketOptions {
  wsEndpoint?: string;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
}

/**
 * WebSocketService handles real-time communication with the Carver API
 */
export class WebSocketService extends EventEmitter {
  private socket: Socket | null = null;
  private authService: AuthService;
  private wsEndpoint: string;
  private reconnectionAttempts: number;
  private reconnectionDelay: number;
  private timeout: number;
  private connected = false;
  private reconnecting = false;
  private messageQueue: { event: string, data: any }[] = [];
  private projectId?: string;
  
  constructor(authService: AuthService, options?: WebSocketOptions) {
    super();
    
    this.authService = authService;
    const config = getConfig();
    
    this.wsEndpoint = options?.wsEndpoint || config.wsEndpoint || config.apiEndpoint?.replace(/^http/, 'ws') || '';
    this.reconnectionAttempts = options?.reconnectionAttempts || 10;
    this.reconnectionDelay = options?.reconnectionDelay || 1000;
    this.timeout = options?.timeout || 30000;
  }
  
  /**
   * Connect to the WebSocket server
   * @param projectId Optional project ID to scope the connection
   * @returns Promise resolving when connected
   */
  async connect(projectId?: string): Promise<void> {
    if (this.socket) {
      // Already connected or connecting
      if (projectId && this.projectId !== projectId) {
        // Project changed, disconnect and reconnect
        await this.disconnect();
      } else {
        return;
      }
    }
    
    this.projectId = projectId;
    
    try {
      // Get authentication token
      const token = await this.authService.getAccessToken();
      
      // Initialize socket connection
      this.socket = io(this.wsEndpoint, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.reconnectionAttempts,
        reconnectionDelay: this.reconnectionDelay,
        timeout: this.timeout,
        auth: {
          token,
          projectId,
        },
      });
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Wait for connection or failure
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket is not initialized'));
          return;
        }
        
        const onConnect = () => {
          this.connected = true;
          this.reconnecting = false;
          resolve();
        };
        
        const onConnectError = (error: Error) => {
          reject(error);
        };
        
        this.socket.once('connect', onConnect);
        this.socket.once('connect_error', onConnectError);
        
        // Cleanup if connection times out
        const timeout = setTimeout(() => {
          if (this.socket) {
            this.socket.off('connect', onConnect);
            this.socket.off('connect_error', onConnectError);
          }
          reject(new Error('WebSocket connection timeout'));
        }, this.timeout);
        
        // Clear timeout when connected
        this.socket.once('connect', () => clearTimeout(timeout));
      });
      
      // Process any queued messages
      this.processMessageQueue();
      
      logger.info('Connected to WebSocket server');
    } catch (error) {
      logger.error('Failed to connect to WebSocket server:', error);
      throw error;
    }
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      // Clean up event listeners
      this.socket.offAny();
      
      // Close the connection
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.reconnecting = false;
      
      logger.info('Disconnected from WebSocket server');
    }
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) {
      return;
    }
    
    // Connection events
    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnecting = false;
      this.emit('connected');
      logger.debug('WebSocket connected');
      
      // Process any queued messages
      this.processMessageQueue();
    });
    
    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.emit('disconnected', reason);
      logger.debug(`WebSocket disconnected: ${reason}`);
    });
    
    this.socket.on('connect_error', (error) => {
      logger.error('WebSocket connection error:', error);
      this.emit('error', error);
    });
    
    this.socket.on('reconnect_attempt', (attempt) => {
      this.reconnecting = true;
      logger.debug(`WebSocket reconnection attempt ${attempt}`);
      this.emit('reconnecting', attempt);
    });
    
    this.socket.on('reconnect', (attempt) => {
      this.connected = true;
      this.reconnecting = false;
      logger.debug(`WebSocket reconnected after ${attempt} attempts`);
      this.emit('reconnected', attempt);
    });
    
    this.socket.on('reconnect_failed', () => {
      this.reconnecting = false;
      logger.error('WebSocket reconnection failed');
      this.emit('reconnect_failed');
    });
    
    // Server messages
    this.socket.on('message', (data) => {
      logger.debug('WebSocket message received:', data);
      this.emit('message', data);
    });
    
    // Project update events
    this.socket.on('project:update', (data) => {
      logger.debug('Project update received:', data);
      this.emit('project:update', data);
    });
    
    // File events
    this.socket.on('file:created', (data) => {
      logger.debug('File created event:', data);
      this.emit('file:created', data);
    });
    
    this.socket.on('file:updated', (data) => {
      logger.debug('File updated event:', data);
      this.emit('file:updated', data);
    });
    
    this.socket.on('file:deleted', (data) => {
      logger.debug('File deleted event:', data);
      this.emit('file:deleted', data);
    });
    
    // Notification events
    this.socket.on('notification', (data) => {
      logger.debug('Notification received:', data);
      this.emit('notification', data);
    });
    
    // Error events
    this.socket.on('error', (error) => {
      logger.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }
  
  /**
   * Send a message to the server
   * @param event Event name
   * @param data Message data
   * @returns Promise resolving when message is sent
   */
  async sendMessage(event: string, data: any): Promise<void> {
    if (!this.connected || !this.socket) {
      // Queue message if not connected
      this.messageQueue.push({ event, data });
      logger.debug(`Message queued (${event}):`, data);
      
      if (!this.socket && !this.reconnecting) {
        // Try to reconnect if not already reconnecting
        try {
          await this.connect(this.projectId);
        } catch (error) {
          logger.error('Failed to reconnect when sending message:', error);
        }
      }
      
      return;
    }
    
    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket is not initialized'));
        return;
      }
      
      this.socket.emit(event, data, (error: any, response: any) => {
        if (error) {
          logger.error(`Error sending message (${event}):`, error);
          reject(error);
        } else {
          logger.debug(`Message sent (${event}):`, data);
          resolve();
        }
      });
    });
  }
  
  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    if (!this.connected || !this.socket || this.messageQueue.length === 0) {
      return;
    }
    
    logger.debug(`Processing ${this.messageQueue.length} queued messages`);
    
    // Take a copy of the queue and clear it
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    // Process each message
    for (const { event, data } of queue) {
      try {
        await this.sendMessage(event, data);
      } catch (error) {
        logger.error(`Failed to send queued message (${event}):`, error);
        // Re-queue the message for later
        this.messageQueue.push({ event, data });
      }
    }
  }
  
  /**
   * Subscribe to project updates
   * @param projectId Project ID
   * @returns Promise resolving when subscribed
   */
  async subscribeToProject(projectId: string): Promise<void> {
    // Connect if not already connected
    if (!this.connected || this.projectId !== projectId) {
      await this.connect(projectId);
    }
    
    await this.sendMessage('subscribe:project', { projectId });
    logger.debug(`Subscribed to project ${projectId} updates`);
  }
  
  /**
   * Unsubscribe from project updates
   * @param projectId Project ID
   * @returns Promise resolving when unsubscribed
   */
  async unsubscribeFromProject(projectId: string): Promise<void> {
    if (!this.connected) {
      return;
    }
    
    await this.sendMessage('unsubscribe:project', { projectId });
    logger.debug(`Unsubscribed from project ${projectId} updates`);
  }
  
  /**
   * Notify about local file changes
   * @param projectId Project ID
   * @param filePath File path
   * @param operation Operation type (create, update, delete)
   * @returns Promise resolving when notification is sent
   */
  async notifyFileChange(projectId: string, filePath: string, operation: 'create' | 'update' | 'delete'): Promise<void> {
    // Connect if not already connected
    if (!this.connected || this.projectId !== projectId) {
      await this.connect(projectId);
    }
    
    await this.sendMessage('file:change', {
      projectId,
      path: filePath,
      operation,
      source: 'client',
      timestamp: Date.now(),
    });
    
    logger.debug(`Notified ${operation} operation on ${filePath}`);
  }
  
  /**
   * Request sync status
   * @param projectId Project ID
   * @returns Promise resolving with sync status
   */
  async requestSyncStatus(projectId: string): Promise<any> {
    // Connect if not already connected
    if (!this.connected || this.projectId !== projectId) {
      await this.connect(projectId);
    }
    
    return new Promise<any>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket is not initialized'));
        return;
      }
      
      this.socket.emit('sync:status', { projectId }, (error: any, status: any) => {
        if (error) {
          logger.error('Error requesting sync status:', error);
          reject(error);
        } else {
          logger.debug('Received sync status:', status);
          resolve(status);
        }
      });
    });
  }
  
  /**
   * Request immediate sync
   * @param projectId Project ID
   * @returns Promise resolving when sync is initiated
   */
  async requestSync(projectId: string): Promise<void> {
    // Connect if not already connected
    if (!this.connected || this.projectId !== projectId) {
      await this.connect(projectId);
    }
    
    await this.sendMessage('sync:request', { projectId });
    logger.debug(`Requested sync for project ${projectId}`);
  }
  
  /**
   * Check if connected to WebSocket server
   * @returns Connection status
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Check if reconnecting to WebSocket server
   * @returns Reconnection status
   */
  isReconnecting(): boolean {
    return this.reconnecting;
  }
  
  /**
   * Get the current project ID
   * @returns Project ID or undefined
   */
  getCurrentProjectId(): string | undefined {
    return this.projectId;
  }
}
