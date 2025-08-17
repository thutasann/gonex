/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Buffer Pool - Efficient Uint8Array pooling for temporary buffer operations
 * with automatic size management and cleanup.
 */

import { logger } from '../../utils/logger';

/**
 * Configuration for buffer pool
 */
export type BufferPoolConfig = {
  /** Maximum number of buffers per size category */
  maxPoolSize: number;
  /** Enable buffer lifecycle monitoring */
  enableMonitoring: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Maximum buffer age in milliseconds */
  maxBufferAge: number;
  /** Enable automatic cleanup of old buffers */
  enableAutoCleanup: boolean;
  /** Size categories for buffer grouping */
  sizeCategories: number[];
  /** Growth factor for buffer size categories */
  growthFactor: number;
};

/**
 * Buffer entry information
 */
type BufferEntry = {
  /** Buffer instance */
  buffer: Uint8Array;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Access count for statistics */
  accessCount: number;
  /** Whether buffer is currently in use */
  inUse: boolean;
  /** Buffer size category */
  sizeCategory: number;
};

/**
 * Buffer pool statistics
 */
export type BufferPoolStats = {
  /** Total number of buffers across all pools */
  totalBuffers: number;
  /** Number of currently allocated buffers */
  allocatedBuffers: number;
  /** Number of available buffers */
  availableBuffers: number;
  /** Memory utilization percentage */
  memoryUtilization: number;
  /** Pool size distribution by category */
  sizeDistribution: Map<number, number>;
  /** Average buffer age in milliseconds */
  averageAge: number;
  /** Pool efficiency metrics */
  efficiency: {
    hitRate: number;
    missRate: number;
    reuseRate: number;
  };
};

/**
 * High-performance buffer pool for Uint8Array instances
 *
 * Features:
 * - Size-based buffer categorization for efficient reuse
 * - Automatic cleanup and memory leak prevention
 * - Performance monitoring and statistics
 * - Configurable size categories and growth policies
 * - Memory utilization optimization
 */
export class BufferPool {
  private pools: Map<number, BufferEntry[]> = new Map();
  private config: Required<BufferPoolConfig>;
  private totalBuffers: number = 0;
  private allocatedBuffers: number = 0;
  private totalCreated: number = 0;
  private totalDestroyed: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config?: Partial<BufferPoolConfig>) {
    this.config = {
      maxPoolSize: 1000,
      enableMonitoring: true,
      cleanupInterval: 300000, // 5 minutes
      maxBufferAge: 1800000, // 30 minutes
      enableAutoCleanup: true,
      sizeCategories: [64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768],
      growthFactor: 2,
      ...config,
    };

    this.initializePools();
    this.startCleanupTimer();

    logger.debug('BufferPool initialized', {
      maxPoolSize: this.config.maxPoolSize,
      sizeCategories: this.config.sizeCategories,
    });
  }

  /**
   * Initialize pools for each size category
   */
  private initializePools(): void {
    for (const size of this.config.sizeCategories) {
      this.pools.set(size, []);
    }
  }

  /**
   * Start the automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.config.enableAutoCleanup && this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Get the appropriate size category for a requested buffer size
   */
  private getSizeCategory(size: number): number {
    // Find the smallest size category that can accommodate the requested size
    for (const category of this.config.sizeCategories) {
      if (category >= size) {
        return category;
      }
    }

    // If no category fits, create a new one by growing the largest
    const largestCategory = Math.max(...this.config.sizeCategories);
    const newCategory = largestCategory * this.config.growthFactor;

    // Add new category if it's reasonable
    if (newCategory <= 1024 * 1024) {
      // Max 1MB per buffer
      this.config.sizeCategories.push(newCategory);
      this.pools.set(newCategory, []);
      logger.debug('New size category added', { size: newCategory });
      return newCategory;
    }

    // Fallback to largest available category
    return largestCategory;
  }

  /**
   * Get a buffer from the pool
   */
  getBuffer(size: number): Uint8Array {
    if (this.isShuttingDown) {
      throw new Error('BufferPool is shutting down');
    }

    if (size <= 0) {
      throw new Error('Buffer size must be positive');
    }

    const sizeCategory = this.getSizeCategory(size);
    const pool = this.pools.get(sizeCategory);

    if (!pool) {
      throw new Error(`No pool found for size category ${sizeCategory}`);
    }

    // Look for available buffer
    for (let i = 0; i < pool.length; i++) {
      const entry = pool[i];
      if (entry) {
        if (!entry.inUse) {
          // Mark as in use and update access info
          entry.inUse = true;
          entry.lastAccessed = Date.now();
          entry.accessCount++;
          this.allocatedBuffers++;

          if (this.config.enableMonitoring) {
            this.updateStats();
          }

          logger.debug('Buffer acquired from pool', {
            size,
            sizeCategory,
            poolIndex: i,
            accessCount: entry.accessCount,
          });

          return entry.buffer;
        }
      }
    }

    // No available buffer, create new one if under max size
    if (pool.length < this.config.maxPoolSize) {
      const buffer = new Uint8Array(sizeCategory);
      const entry: BufferEntry = {
        buffer,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        inUse: true,
        sizeCategory,
      };

      pool.push(entry);
      this.totalBuffers++;
      this.allocatedBuffers++;
      this.totalCreated++;

      if (this.config.enableMonitoring) {
        this.updateStats();
      }

      logger.debug('New buffer created for pool', {
        size,
        sizeCategory,
        poolSize: pool.length,
        totalCreated: this.totalCreated,
      });

      return buffer;
    } else {
      throw new Error(
        `Cannot get buffer: pool size limit exceeded (${pool.length}/${this.config.maxPoolSize})`
      );
    }
  }

  /**
   * Return a buffer to the pool
   */
  returnBuffer(buffer: Uint8Array): void {
    if (this.isShuttingDown) {
      return;
    }

    const size = buffer.byteLength;
    const pool = this.pools.get(size);

    if (!pool) {
      logger.warn('Attempted to return buffer not from pool', { size });
      return;
    }

    // Find and mark buffer as available
    for (const entry of pool) {
      if (entry.buffer === buffer && entry.inUse) {
        entry.inUse = false;
        entry.lastAccessed = Date.now();
        this.allocatedBuffers--;

        if (this.config.enableMonitoring) {
          this.updateStats();
        }

        logger.debug('Buffer returned to pool', { size });
        return;
      }
    }

    logger.warn('Attempted to return buffer not found in pool', { size });
  }

  /**
   * Clear all buffers from the pool
   */
  clear(): void {
    for (const [_, pool] of this.pools) {
      pool.length = 0;
    }

    this.totalDestroyed += this.totalBuffers;
    this.totalBuffers = 0;
    this.allocatedBuffers = 0;

    logger.info('Buffer pool cleared', {
      totalDestroyed: this.totalDestroyed,
    });
  }

  /**
   * Get total number of buffers across all pools
   */
  getTotalBuffers(): number {
    return this.totalBuffers;
  }

  /**
   * Get pool sizes for each size category
   */
  getPoolSizes(): Map<number, number> {
    const poolSizes = new Map<number, number>();

    for (const [size, pool] of this.pools) {
      poolSizes.set(size, pool.length);
    }

    return poolSizes;
  }

  /**
   * Get comprehensive pool statistics
   */
  getStats(): BufferPoolStats {
    const availableBuffers = this.totalBuffers - this.allocatedBuffers;
    const memoryUtilization =
      this.totalBuffers > 0
        ? (this.allocatedBuffers / this.totalBuffers) * 100
        : 0;

    // Calculate size distribution
    const sizeDistribution = new Map<number, number>();
    for (const [size, pool] of this.pools) {
      sizeDistribution.set(size, pool.length);
    }

    // Calculate average buffer age
    let totalAge = 0;
    let bufferCount = 0;

    for (const pool of this.pools.values()) {
      for (const entry of pool) {
        totalAge += Date.now() - entry.createdAt;
        bufferCount++;
      }
    }

    const averageAge = bufferCount > 0 ? totalAge / bufferCount : 0;

    // Calculate efficiency metrics
    const hitRate =
      this.totalCreated > 0
        ? ((this.totalCreated - this.totalBuffers) / this.totalCreated) * 100
        : 0;
    const missRate = 100 - hitRate;
    const reuseRate =
      this.totalCreated > 0 ? this.totalCreated / this.totalBuffers : 0;

    return {
      totalBuffers: this.totalBuffers,
      allocatedBuffers: this.allocatedBuffers,
      availableBuffers,
      memoryUtilization,
      sizeDistribution,
      averageAge,
      efficiency: {
        hitRate,
        missRate,
        reuseRate,
      },
    };
  }

  /**
   * Perform pool cleanup
   */
  cleanup(): void {
    if (this.isShuttingDown || !this.config.enableAutoCleanup) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - this.config.maxBufferAge;
    let cleanedCount = 0;

    // Remove old, unused buffers
    for (const [size, pool] of this.pools) {
      const originalLength = pool.length;
      const filteredPool = pool.filter(entry => {
        if (!entry.inUse && entry.createdAt < cutoffTime) {
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
      this.totalBuffers -= cleanedCount;
      this.totalDestroyed += cleanedCount;

      logger.info('Buffer pool cleanup completed', {
        cleanedCount,
        remainingBuffers: this.totalBuffers,
        totalDestroyed: this.totalDestroyed,
      });

      this.updateStats();
    }

    // Replenish pools if needed
    this.replenishPools();
  }

  /**
   * Replenish pools with new buffers if needed
   */
  private replenishPools(): void {
    for (const [size, pool] of this.pools) {
      const targetSize = Math.min(
        this.config.maxPoolSize,
        Math.max(2, Math.ceil(this.allocatedBuffers * 0.1)) // 10% of allocated
      );

      while (pool.length < targetSize) {
        const buffer = new Uint8Array(size);
        const entry: BufferEntry = {
          buffer,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 0,
          inUse: false,
          sizeCategory: size,
        };

        pool.push(entry);
        this.totalBuffers++;
        this.totalCreated++;
      }
    }
  }

  /**
   * Update monitoring statistics
   */
  private updateStats(): void {
    if (this.config.enableMonitoring) {
      const stats = this.getStats();
      logger.debug('Buffer pool stats updated', { stats });
    }
  }

  /**
   * Get pool health information
   */
  getHealthInfo(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const stats = this.getStats();

    // Check memory utilization
    if (stats.memoryUtilization > 90) {
      issues.push('High memory utilization');
      recommendations.push(
        'Consider increasing pool sizes or reducing buffer usage'
      );
    }

    // Check efficiency
    if (stats.efficiency.hitRate < 50) {
      issues.push('Low buffer reuse rate');
      recommendations.push('Review buffer lifecycle and size categories');
    }

    // Check buffer age
    if (stats.averageAge > this.config.maxBufferAge) {
      issues.push('Buffers are aging out frequently');
      recommendations.push('Review maxBufferAge configuration');
    }

    const healthy = issues.length === 0;

    return {
      healthy,
      issues,
      recommendations,
    };
  }

  /**
   * Shutdown the buffer pool
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

    // Clear all buffers
    this.clear();

    logger.info('BufferPool shutdown completed');
  }
}
