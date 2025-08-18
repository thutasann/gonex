/**
 * Shared Memory Manager - Core infrastructure for managing SharedArrayBuffer instances
 * across worker threads with automatic lifecycle management and memory optimization.
 */

import { logger } from '../../utils';

/**
 * Configuration for shared memory management
 */
export type SharedMemoryConfig = {
  /** Default buffer size in bytes */
  bufferSize: number;
  /** Enable data compression for large buffers */
  enableCompression: boolean;
  /** Enable encryption for sensitive data */
  enableEncryption: boolean;
  /** Maximum number of buffers to maintain */
  maxBuffers: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Enable memory usage monitoring */
  enableMonitoring: boolean;
};

/**
 * Memory usage statistics
 */
export type MemoryUsage = {
  /** Total allocated memory in bytes */
  total: number;
  /** Currently used memory in bytes */
  used: number;
  /** Number of active buffers */
  buffers: number;
  /** Memory overhead in bytes */
  overhead: number;
  /** Peak memory usage in bytes */
  peak: number;
};

/**
 * Buffer metadata for tracking and management
 */
export type BufferMetadata = {
  /** Unique identifier for the buffer */
  id: string;
  /** Buffer size in bytes */
  size: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Access count for LRU eviction */
  accessCount: number;
  /** Buffer flags and configuration */
  flags: number;
  /** Associated worker thread IDs */
  workerIds: Set<number>;
};

/**
 * High-performance shared memory manager
 *
 * Provides efficient SharedArrayBuffer lifecycle management with:
 * - Automatic memory cleanup and leak prevention
 * - Worker thread association tracking
 * - Memory usage monitoring and optimization
 * - Thread-safe buffer operations
 */
export class SharedMemoryManager {
  private buffers: Map<string, SharedArrayBuffer> = new Map();
  private metadata: Map<string, BufferMetadata> = new Map();
  private config: Required<SharedMemoryConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private peakMemoryUsage = 0;
  private isShuttingDown = false;

  constructor(config?: Partial<SharedMemoryConfig>) {
    this.config = {
      bufferSize: 1024 * 1024, // 1MB default
      enableCompression: false,
      enableEncryption: false,
      maxBuffers: 100,
      cleanupInterval: 60000, // 1 minute
      enableMonitoring: true,
      ...config,
    };

    this.startCleanupTimer();
    logger.info('SharedMemoryManager initialized', { config: this.config });
  }

  /**
   * Create a new shared memory buffer
   *
   * @param size - Buffer size in bytes
   * @param name - Optional buffer name for identification
   * @param workerId - Optional worker thread ID for association
   * @returns SharedArrayBuffer instance
   *
   * @throws Error if buffer creation fails or limit exceeded
   */
  createBuffer(
    size: number,
    name?: string,
    workerId?: number
  ): SharedArrayBuffer {
    if (this.isShuttingDown) {
      throw new Error('SharedMemoryManager is shutting down');
    }

    if (size <= 0) {
      throw new Error('Buffer size must be positive');
    }

    if (this.buffers.size >= this.config.maxBuffers) {
      this.evictOldestBuffer();
    }

    try {
      const buffer = new SharedArrayBuffer(size);
      const id = name || this.generateBufferId();

      const metadata: BufferMetadata = {
        id,
        size,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        flags: 0,
        workerIds: workerId ? new Set([workerId]) : new Set(),
      };

      this.buffers.set(id, buffer);
      this.metadata.set(id, metadata);

      if (this.config.enableMonitoring) {
        this.updateMemoryUsage();
      }
      logger.debug('Shared memory buffer created', { id, size, workerId });
      return buffer;
    } catch (error) {
      logger.error(
        'Failed to create shared memory buffer',
        new Error('Failed to create shared memory buffer'),
        { size, error }
      );
      throw new Error(
        `Failed to create buffer: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get an existing shared memory buffer by name
   *
   * @param name - Buffer name/ID
   * @param workerId - Optional worker thread ID for access tracking
   * @returns SharedArrayBuffer or undefined if not found
   */
  getBuffer(name: string, workerId?: number): SharedArrayBuffer | undefined {
    const buffer = this.buffers.get(name);

    if (buffer && workerId) {
      const metadata = this.metadata.get(name);
      if (metadata) {
        metadata.lastAccessed = Date.now();
        metadata.accessCount++;
        if (!metadata.workerIds.has(workerId)) {
          metadata.workerIds.add(workerId);
        }
      }
    }

    return buffer;
  }

  /**
   * Release a shared memory buffer
   *
   * @param name - Buffer name/ID
   * @param workerId - Optional worker thread ID for disassociation
   * @returns true if buffer was released, false if not found
   */
  releaseBuffer(name: string, workerId?: number): boolean {
    const buffer = this.buffers.get(name);
    if (!buffer) {
      return false;
    }

    if (workerId) {
      const metadata = this.metadata.get(name);
      if (metadata) {
        metadata.workerIds.delete(workerId);

        // Only release if no workers are using it
        if (metadata.workerIds.size === 0) {
          this.buffers.delete(name);
          this.metadata.delete(name);

          if (this.config.enableMonitoring) {
            this.updateMemoryUsage();
          }

          logger.debug('Shared memory buffer released', { name, workerId });
          return true;
        }
      }
    } else {
      // Force release regardless of worker associations
      this.buffers.delete(name);
      this.metadata.delete(name);

      if (this.config.enableMonitoring) {
        this.updateMemoryUsage();
      }

      logger.debug('Shared memory buffer force released', { name });
      return true;
    }

    return false;
  }

  /**
   * List all available buffer names
   *
   * @returns Array of buffer names
   */
  listBuffers(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * Get buffer metadata for monitoring
   *
   * @param name - Buffer name/ID
   * @returns Buffer metadata or undefined if not found
   */
  getBufferMetadata(name: string): BufferMetadata | undefined {
    return this.metadata.get(name);
  }

  /**
   * Copy data to a shared memory buffer
   *
   * @param data - Data to copy
   * @param buffer - Target SharedArrayBuffer
   * @param offset - Starting offset in the buffer
   * @returns Number of bytes copied
   */
  copyToBuffer(
    data: Uint8Array,
    buffer: SharedArrayBuffer,
    offset: number
  ): number {
    if (offset < 0 || offset >= buffer.byteLength) {
      throw new Error('Invalid buffer offset');
    }

    const availableSpace = buffer.byteLength - offset;
    const bytesToCopy = Math.min(data.length, availableSpace);

    const uint8View = new Uint8Array(buffer, offset, bytesToCopy);
    uint8View.set(data.subarray(0, bytesToCopy));

    return bytesToCopy;
  }

  /**
   * Copy data from a shared memory buffer
   *
   * @param buffer - Source SharedArrayBuffer
   * @param offset - Starting offset in the buffer
   * @param length - Number of bytes to copy
   * @returns Uint8Array containing the copied data
   */
  copyFromBuffer(
    buffer: SharedArrayBuffer,
    offset: number,
    length: number
  ): Uint8Array {
    if (offset < 0 || offset + length > buffer.byteLength) {
      throw new Error('Invalid buffer range');
    }

    const uint8View = new Uint8Array(buffer, offset, length);
    return new Uint8Array(uint8View);
  }

  /**
   * Associate a worker thread with a buffer
   *
   * @param bufferName - Buffer name/ID
   * @param workerId - Worker thread ID
   * @returns true if association was successful
   */
  associateWorker(bufferName: string, workerId: number): boolean {
    const metadata = this.metadata.get(bufferName);
    if (!metadata) {
      return false;
    }
    metadata.workerIds.add(workerId);
    metadata.lastAccessed = Date.now();
    return true;
  }

  /**
   * Disassociate a worker thread from a buffer
   *
   * @param bufferName - Buffer name/ID
   * @param workerId - Worker thread ID
   * @returns true if disassociation was successful
   */
  disassociateWorker(bufferName: string, workerId: number): boolean {
    const metadata = this.metadata.get(bufferName);
    if (!metadata) {
      return false;
    }

    return metadata.workerIds.delete(workerId);
  }

  /**
   * Get current memory usage statistics
   *
   * @returns Memory usage information
   */
  getMemoryUsage(): MemoryUsage {
    let total = 0;
    let used = 0;

    for (const [name, buffer] of this.buffers) {
      total += buffer.byteLength;
      const metadata = this.metadata.get(name);
      if (metadata && metadata.workerIds.size > 0) {
        used += buffer.byteLength;
      }
    }

    return {
      total,
      used,
      buffers: this.buffers.size,
      overhead: this.metadata.size * 64, // Approximate metadata overhead
      peak: this.peakMemoryUsage,
    };
  }

  /**
   * Perform memory cleanup and optimization
   */
  cleanup(): void {
    if (this.isShuttingDown) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - this.config.cleanupInterval * 2; // 2x cleanup interval

    let cleanedCount = 0;

    for (const [name, metadata] of this.metadata) {
      if (metadata.lastAccessed < cutoffTime && metadata.workerIds.size === 0) {
        this.buffers.delete(name);
        this.metadata.delete(name);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Memory cleanup completed', { cleanedCount });
      this.updateMemoryUsage();
    }
  }

  /**
   * Shutdown the shared memory manager
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Release all buffers
    this.buffers.clear();
    this.metadata.clear();

    logger.info('SharedMemoryManager shutdown completed');
  }

  /**
   * Start the automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Update memory usage tracking
   */
  private updateMemoryUsage(): void {
    const usage = this.getMemoryUsage();
    if (usage.total > this.peakMemoryUsage) {
      this.peakMemoryUsage = usage.total;
    }
  }

  /**
   * Evict the oldest/least used buffer
   */
  private evictOldestBuffer(): void {
    let oldestName: string | null = null;
    let oldestTime = Date.now();

    for (const [name, metadata] of this.metadata) {
      if (metadata.lastAccessed < oldestTime && metadata.workerIds.size === 0) {
        oldestTime = metadata.lastAccessed;
        oldestName = name;
      }
    }

    if (oldestName) {
      this.releaseBuffer(oldestName);
      logger.debug('Evicted oldest buffer', { name: oldestName });
    }
  }

  /**
   * Generate a unique buffer ID
   */
  private generateBufferId(): string {
    return `buffer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
