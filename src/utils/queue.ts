import * as fs from 'fs-extra';
import * as path from 'path';
import { getConfig } from './config';
import { logger } from './logger';

export interface QueueItem<T> {
  id: string;
  type: string;
  data: T;
  timestamp: number;
  priority: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
}

export interface QueueOptions {
  storageDir?: string;
  maxRetries?: number;
  persistInterval?: number;
  processBatchSize?: number;
}

/**
 * RequestQueue manages queued operations for offline handling
 */
export class RequestQueue<T = any> {
  private queue: QueueItem<T>[] = [];
  private isProcessing = false;
  private storageDir: string;
  private queueFile: string;
  private maxRetries: number;
  private persistInterval: number;
  private processBatchSize: number;
  private persistTimeoutId?: NodeJS.Timeout;
  private processor?: (item: QueueItem<T>) => Promise<void>;
  
  constructor(queueName: string, options?: QueueOptions) {
    const config = getConfig();
    
    // Set up storage location
    this.storageDir = options?.storageDir || path.join(config.dataDir || '.carver', 'queues');
    this.queueFile = path.join(this.storageDir, `${queueName}.json`);
    
    // Set configuration
    this.maxRetries = options?.maxRetries || 5;
    this.persistInterval = options?.persistInterval || 5000; // 5 seconds
    this.processBatchSize = options?.processBatchSize || 10;
    
    // Ensure directory exists
    fs.mkdirSync(this.storageDir, { recursive: true });
    
    // Load queue from disk if exists
    this.loadQueue();
    
    // Schedule periodic persistence
    this.schedulePersistence();
  }
  
  /**
   * Load queue from disk
   */
  private loadQueue(): void {
    try {
      if (fs.existsSync(this.queueFile)) {
        const data = fs.readFileSync(this.queueFile, 'utf8');
        this.queue = JSON.parse(data);
        logger.debug(`Loaded ${this.queue.length} items from queue file ${this.queueFile}`);
      }
    } catch (error) {
      logger.error(`Failed to load queue from ${this.queueFile}:`, error);
      // Start with an empty queue if loading fails
      this.queue = [];
    }
  }
  
  /**
   * Save queue to disk
   */
  private saveQueue(): void {
    try {
      fs.writeFileSync(this.queueFile, JSON.stringify(this.queue, null, 2), 'utf8');
      logger.debug(`Saved ${this.queue.length} items to queue file ${this.queueFile}`);
    } catch (error) {
      logger.error(`Failed to save queue to ${this.queueFile}:`, error);
    }
  }
  
  /**
   * Schedule periodic persistence
   */
  private schedulePersistence(): void {
    this.persistTimeoutId = setTimeout(() => {
      this.saveQueue();
      this.schedulePersistence();
    }, this.persistInterval);
  }
  
  /**
   * Add an item to the queue
   * @param type Item type
   * @param data Item data
   * @param priority Priority (higher number = higher priority)
   * @returns Added queue item
   */
  enqueue(type: string, data: T, priority = 1): QueueItem<T> {
    const item: QueueItem<T> = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      type,
      data,
      timestamp: Date.now(),
      priority,
      retryCount: 0,
      status: 'pending',
    };
    
    this.queue.push(item);
    logger.debug(`Enqueued item ${item.id} of type ${type} with priority ${priority}`);
    
    // Save queue when adding new items
    this.saveQueue();
    
    return item;
  }
  
  /**
   * Get an item from the queue by ID
   * @param id Item ID
   * @returns Queue item or undefined if not found
   */
  getItem(id: string): QueueItem<T> | undefined {
    return this.queue.find(item => item.id === id);
  }
  
  /**
   * Remove an item from the queue
   * @param id Item ID
   * @returns True if item was removed, false if not found
   */
  removeItem(id: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(item => item.id !== id);
    const removed = initialLength > this.queue.length;
    
    if (removed) {
      logger.debug(`Removed item ${id} from queue`);
      this.saveQueue();
    }
    
    return removed;
  }
  
  /**
   * Get all items in the queue
   * @returns Array of queue items
   */
  getAllItems(): QueueItem<T>[] {
    return [...this.queue];
  }
  
  /**
   * Get items by type
   * @param type Item type
   * @returns Array of queue items matching the type
   */
  getItemsByType(type: string): QueueItem<T>[] {
    return this.queue.filter(item => item.type === type);
  }
  
  /**
   * Get count of items by status
   * @returns Object with counts by status
   */
  getItemCounts(): { total: number, pending: number, processing: number, failed: number } {
    return {
      total: this.queue.length,
      pending: this.queue.filter(item => item.status === 'pending').length,
      processing: this.queue.filter(item => item.status === 'processing').length,
      failed: this.queue.filter(item => item.status === 'failed').length,
    };
  }
  
  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.queue = [];
    logger.debug('Cleared all items from queue');
    this.saveQueue();
  }
  
  /**
   * Clear failed items from the queue
   */
  clearFailed(): void {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(item => item.status !== 'failed');
    const removed = initialLength - this.queue.length;
    
    if (removed > 0) {
      logger.debug(`Cleared ${removed} failed items from queue`);
      this.saveQueue();
    }
  }
  
  /**
   * Retry a failed item
   * @param id Item ID
   * @returns True if item was reset for retry, false if not found or not failed
   */
  retryItem(id: string): boolean {
    const item = this.queue.find(item => item.id === id);
    
    if (item && item.status === 'failed') {
      item.status = 'pending';
      item.error = undefined;
      logger.debug(`Reset failed item ${id} for retry`);
      this.saveQueue();
      return true;
    }
    
    return false;
  }
  
  /**
   * Retry all failed items
   * @returns Number of items reset for retry
   */
  retryAllFailed(): number {
    let count = 0;
    
    for (const item of this.queue) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.error = undefined;
        count++;
      }
    }
    
    if (count > 0) {
      logger.debug(`Reset ${count} failed items for retry`);
      this.saveQueue();
    }
    
    return count;
  }
  
  /**
   * Set the item processor function
   * @param processor Function to process queue items
   */
  setProcessor(processor: (item: QueueItem<T>) => Promise<void>): void {
    this.processor = processor;
  }
  
  /**
   * Start processing the queue
   * @returns Promise that resolves when processing is complete
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.processor) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Sort queue by priority (higher first) then timestamp (older first)
      this.queue.sort((a, b) => {
        if (a.status !== 'pending' || b.status !== 'pending') {
          if (a.status === 'pending') return -1;
          if (b.status === 'pending') return 1;
          return 0;
        }
        
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        
        return a.timestamp - b.timestamp;
      });
      
      // Process in batches
      while (this.queue.some(item => item.status === 'pending')) {
        const batch = this.queue
          .filter(item => item.status === 'pending')
          .slice(0, this.processBatchSize);
        
        if (batch.length === 0) {
          break;
        }
        
        logger.debug(`Processing batch of ${batch.length} queue items`);
        
        // Process batch in parallel
        await Promise.all(batch.map(async item => {
          item.status = 'processing';
          
          try {
            await this.processor!(item);
            
            // Successfully processed, remove from queue
            this.removeItem(item.id);
          } catch (error) {
            // Failed to process
            item.retryCount++;
            
            if (item.retryCount >= this.maxRetries) {
              // Max retries exceeded, mark as failed
              item.status = 'failed';
              item.error = error instanceof Error ? error.message : String(error);
              logger.error(`Queue item ${item.id} failed after ${item.retryCount} attempts: ${item.error}`);
            } else {
              // Reset to pending for retry
              item.status = 'pending';
              logger.debug(`Queue item ${item.id} failed, will retry (${item.retryCount}/${this.maxRetries})`);
            }
          }
        }));
        
        // Save progress after each batch
        this.saveQueue();
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Dispose the queue and clean up resources
   */
  dispose(): void {
    if (this.persistTimeoutId) {
      clearTimeout(this.persistTimeoutId);
    }
    
    // Save one final time
    this.saveQueue();
  }
}
