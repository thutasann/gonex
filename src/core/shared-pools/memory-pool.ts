/**
 * Memory Pool - Efficient SharedArrayBuffer pooling for high-performance
 * memory management with automatic cleanup and optimization.
 */

import { logger } from '../../utils';

/**
 * Configuration for memory pool
 */
export type PoolConfig = {
  /** Initial pool size in bytes */
  initialSize: number;
  /** Maximum pool size in bytes */
  maxSize: number;
  /** Growth factor for pool expansion */
  growthFactor: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Enable memory usage monitoring */
  enableMonitoring: boolean;
  /** Minimum buffer size to pool */
  minBufferSize: number;
  /** Maximum buffer size to pool */
  maxBufferSize: number;
};

/**
 * Pool statistics
 */
export type PoolStats = {
  /** Total allocated memory in bytes */
  totalAllocated: number;
  /** Number of active pools */
  poolCount: number;
  /** Number of available buffers */
  availableBuffers: number;
  /** Memory utilization percentage */
  utilization: number;
  /** Peak memory usage in bytes */
  peakUsage: number;
  /** Pool size distribution */
  sizeDistribution: Map<number, number>;
};

/**
 * Pool entry information
 */
type PoolEntry = {
  /** Buffer instance */
  buffer: SharedArrayBuffer;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Access count for LRU eviction */
  accessCount: number;
  /** Whether buffer is currently in use */
  inUse: boolean;
};

/**
 * High-performance memory pool for SharedArrayBuffer instances
 *
 * Features:
 * - Size-based pooling for efficient memory reuse
 * - Automatic cleanup and memory leak prevention
 * - LRU eviction for optimal memory utilization
 * - Performance monitoring and statistics
 * - Configurable growth and shrinkage policies
 */
export class MemoryPool {
  private pools: Map<number, PoolEntry[]> = new Map();
  private config: Required<PoolConfig>;
  private totalAllocated: number = 0;
  private peakUsage: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      initialSize: 1024 * 1024, // 1MB default
      maxSize: 100 * 1024 * 1024, // 100MB default
      growthFactor: 2,
      cleanupInterval: 60000, // 1 minute
      enableMonitoring: true,
      minBufferSize: 64, // 64 bytes minimum
      maxBufferSize: 10 * 1024 * 1024, // 10MB maximum
      ...config,
    };

    this.startCleanupTimer();
    logger.debug('MemoryPool initialized', { config: this.config });
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
   * Allocate a buffer from the pool
   */
  allocate(size: number): SharedArrayBuffer {
    if (this.isShuttingDown) {
      throw new Error('MemoryPool is shutting down');
    }

    if (size < this.config.minBufferSize || size > this.config.maxBufferSize) {
      throw new Error(
        `Buffer size ${size} is outside allowed range [${this.config.minBufferSize}, ${this.config.maxBufferSize}]`
      );
    }

    // Find the appropriate pool size (round up to next power of 2)
    const poolSize = this.getNextPoolSize(size);

    let pool = this.pools.get(poolSize);
    if (!pool) {
      pool = [];
      this.pools.set(poolSize, pool);
    }

    // Look for available buffer
    for (let i = 0; i < pool.length; i++) {
      const entry = pool[i];
      if (entry && !entry?.inUse) {
        // Mark as in use and update access info
        entry.inUse = true;
        entry.lastAccessed = Date.now();
        entry.accessCount++;

        if (this.config.enableMonitoring) {
          this.updateStats();
        }

        logger.debug('Buffer allocated from pool', {
          size,
          poolSize,
          bufferId: i,
        });
        return entry.buffer;
      }
    }

    // No available buffer, create new one
    if (this.totalAllocated + poolSize <= this.config.maxSize) {
      const buffer = new SharedArrayBuffer(poolSize);
      const entry: PoolEntry = {
        buffer,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        inUse: true,
      };

      pool.push(entry);
      this.totalAllocated += poolSize;
      this.peakUsage = Math.max(this.peakUsage, this.totalAllocated);

      if (this.config.enableMonitoring) {
        this.updateStats();
      }

      logger.debug('New buffer created for pool', {
        size,
        poolSize,
        totalAllocated: this.totalAllocated,
      });
      return buffer;
    } else {
      throw new Error(
        `Cannot allocate buffer: pool size limit exceeded (${this.totalAllocated}/${this.config.maxSize})`
      );
    }
  }

  /**
   * Release a buffer back to the pool
   */
  release(buffer: SharedArrayBuffer): void {
    if (this.isShuttingDown) {
      return;
    }

    const size = buffer.byteLength;
    const pool = this.pools.get(size);

    if (!pool) {
      logger.warn('Attempted to release buffer not from pool', { size });
      return;
    }

    // Find and mark buffer as available
    for (const entry of pool) {
      if (entry.buffer === buffer && entry.inUse) {
        entry.inUse = false;
        entry.lastAccessed = Date.now();

        if (this.config.enableMonitoring) {
          this.updateStats();
        }

        logger.debug('Buffer released to pool', { size });
        return;
      }
    }

    logger.warn('Attempted to release buffer not found in pool', { size });
  }

  /**
   * Get pool information for a specific size
   */
  getPool(size: number): PoolEntry[] {
    const poolSize = this.getNextPoolSize(size);
    return this.pools.get(poolSize) || [];
  }

  /**
   * Get total allocated memory
   */
  getTotalAllocated(): number {
    return this.totalAllocated;
  }

  /**
   * Get number of pools
   */
  getPoolCount(): number {
    return this.pools.size;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    let availableBuffers = 0;
    const sizeDistribution = new Map<number, number>();

    for (const [size, pool] of this.pools) {
      const available = pool.filter(entry => !entry.inUse).length;
      availableBuffers += available;
      sizeDistribution.set(size, pool.length);
    }

    const utilization =
      this.totalAllocated > 0
        ? ((this.totalAllocated -
            availableBuffers * this.getAverageBufferSize()) /
            this.totalAllocated) *
          100
        : 0;

    return {
      totalAllocated: this.totalAllocated,
      poolCount: this.pools.size,
      availableBuffers,
      utilization,
      peakUsage: this.peakUsage,
      sizeDistribution,
    };
  }

  /**
   * Perform memory cleanup
   */
  cleanup(): void {
    if (this.isShuttingDown) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - this.config.cleanupInterval * 2; // 2x cleanup interval
    let cleanedCount = 0;

    for (const [size, pool] of this.pools) {
      // Remove unused buffers older than cutoff time
      const originalLength = pool.length;
      const filteredPool = pool.filter(entry => {
        if (!entry.inUse && entry.lastAccessed < cutoffTime) {
          this.totalAllocated -= size;
          cleanedCount++;
          return false;
        }
        return true;
      });

      if (filteredPool.length !== originalLength) {
        this.pools.set(size, filteredPool);
      }
    }

    if (cleanedCount > 0) {
      logger.info('Memory cleanup completed', {
        cleanedCount,
        totalAllocated: this.totalAllocated,
      });
      this.updateStats();
    }
  }

  /**
   * Get next pool size (round up to power of 2)
   */
  private getNextPoolSize(size: number): number {
    let poolSize = this.config.minBufferSize;
    while (poolSize < size) {
      poolSize *= this.config.growthFactor;
    }
    return Math.min(poolSize, this.config.maxBufferSize);
  }

  /**
   * Get average buffer size across all pools
   */
  private getAverageBufferSize(): number {
    if (this.pools.size === 0) return 0;

    let totalSize = 0;
    let totalCount = 0;

    for (const [size, pool] of this.pools) {
      totalSize += size * pool.length;
      totalCount += pool.length;
    }

    return totalCount > 0 ? totalSize / totalCount : 0;
  }

  /**
   * Update monitoring statistics
   */
  private updateStats(): void {
    if (this.config.enableMonitoring) {
      const stats = this.getStats();
      logger.debug('Memory pool stats updated', { stats });
    }
  }

  /**
   * Shutdown the memory pool
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

    // Clear all pools
    this.pools.clear();
    this.totalAllocated = 0;

    logger.info('MemoryPool shutdown completed');
  }
}
