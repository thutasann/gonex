/**
 * Object Pool - Efficient object pooling for expensive objects with
 * automatic lifecycle management and validation.
 */

import { logger } from '../../utils/logger';

/**
 * Configuration for object pool
 */
export type ObjectPoolConfig<T> = {
  /** Initial pool size */
  initialSize: number;
  /** Maximum pool size */
  maxSize: number;
  /** Factory function to create new objects */
  factory: () => T;
  /** Function to reset objects before reuse */
  reset: (obj: T) => void;
  /** Function to validate objects before reuse */
  validate: (obj: T) => boolean;
  /** Enable object lifecycle monitoring */
  enableMonitoring: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Maximum age of objects in milliseconds */
  maxObjectAge: number;
  /** Enable automatic cleanup of old objects */
  enableAutoCleanup: boolean;
};

/**
 * Pool entry information
 */
type PoolEntry<T> = {
  /** Object instance */
  object: T;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Access count for statistics */
  accessCount: number;
  /** Whether object is currently in use */
  inUse: boolean;
  /** Object health status */
  isValid: boolean;
};

/**
 * Object pool statistics
 */
export type ObjectPoolStats = {
  /** Current pool size */
  size: number;
  /** Number of allocated objects */
  allocated: number;
  /** Number of available objects */
  available: number;
  /** Total objects created since pool start */
  totalCreated: number;
  /** Total objects destroyed since pool start */
  totalDestroyed: number;
  /** Object utilization percentage */
  utilization: number;
  /** Average object age in milliseconds */
  averageAge: number;
  /** Pool efficiency (hits vs misses) */
  efficiency: number;
};

/**
 * High-performance object pool for expensive object reuse
 *
 * Features:
 * - Automatic object lifecycle management
 * - Object validation and health checking
 * - Configurable cleanup and aging policies
 * - Performance monitoring and statistics
 * - Thread-safe object acquisition and release
 * - Memory leak prevention
 */
export class ObjectPool<T> {
  private pool: PoolEntry<T>[] = [];
  private config: Required<ObjectPoolConfig<T>>;
  private allocated: number = 0;
  private totalCreated: number = 0;
  private totalDestroyed: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: ObjectPoolConfig<T>) {
    this.config = {
      initialSize: 10,
      maxSize: 1000,
      factory: config.factory,
      reset: config.reset,
      validate: config.validate,
      enableMonitoring: true,
      cleanupInterval: 300000, // 5 minutes
      maxObjectAge: 1800000, // 30 minutes
      enableAutoCleanup: true,
    };

    this.initializePool();
    this.startCleanupTimer();

    logger.debug('ObjectPool initialized', {
      initialSize: this.config.initialSize,
      maxSize: this.config.maxSize,
    });
  }

  /**
   * Initialize the pool with initial objects
   */
  private initializePool(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      this.createPoolEntry();
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
   * Create a new pool entry
   */
  private createPoolEntry(): void {
    if (this.pool.length >= this.config.maxSize) {
      logger.warn('Cannot create pool entry: maximum size reached', {
        currentSize: this.pool.length,
        maxSize: this.config.maxSize,
      });
      return;
    }

    try {
      const object = this.config.factory();
      const entry: PoolEntry<T> = {
        object,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        inUse: false,
        isValid: true,
      };

      this.pool.push(entry);
      this.totalCreated++;

      logger.debug('Pool entry created', {
        poolSize: this.pool.length,
        totalCreated: this.totalCreated,
      });
    } catch (error: AnyValue) {
      logger.error('Failed to create pool entry', error);
    }
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T | null {
    if (this.isShuttingDown) {
      throw new Error('ObjectPool is shutting down');
    }

    // Look for available object in pool
    for (let i = 0; i < this.pool.length; i++) {
      const entry = this.pool[i];
      if (entry) {
        if (!entry.inUse && entry.isValid) {
          // Validate object before reuse
          if (this.config.validate(entry.object)) {
            // Mark as in use and update access info
            entry.inUse = true;
            entry.lastAccessed = Date.now();
            entry.accessCount++;
            this.allocated++;

            if (this.config.enableMonitoring) {
              this.updateStats();
            }

            logger.debug('Object acquired from pool', {
              poolIndex: i,
              accessCount: entry.accessCount,
            });
            return entry.object;
          } else {
            // Object failed validation, mark as invalid
            entry.isValid = false;
            logger.debug('Object failed validation, marked as invalid', {
              poolIndex: i,
            });
          }
        }
      }
    }

    // No available objects, create new one if under max size
    if (this.pool.length < this.config.maxSize) {
      this.createPoolEntry();
      const newEntry = this.pool[this.pool.length - 1];
      if (newEntry) {
        newEntry.inUse = true;
        newEntry.lastAccessed = Date.now();
        newEntry.accessCount = 1;
        this.allocated++;

        if (this.config.enableMonitoring) {
          this.updateStats();
        }

        logger.debug('New object created and acquired', {
          poolSize: this.pool.length,
          totalCreated: this.totalCreated,
        });
        return newEntry.object;
      }
    } else {
      throw new Error(
        `Cannot acquire object: pool is full (${this.pool.length}/${this.config.maxSize})`
      );
    }

    return null;
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    if (this.isShuttingDown) {
      return;
    }

    // Find object in pool
    for (let i = 0; i < this.pool.length; i++) {
      const entry = this.pool[i];
      if (entry) {
        if (entry.object === obj && entry.inUse) {
          // Reset object before reuse
          try {
            this.config.reset(entry.object);
            entry.inUse = false;
            entry.lastAccessed = Date.now();
            this.allocated--;

            if (this.config.enableMonitoring) {
              this.updateStats();
            }

            logger.debug('Object released to pool', { poolIndex: i });
            return;
          } catch (error: AnyValue) {
            logger.error('Failed to reset object', error);
            // Mark object as invalid if reset fails
            entry.isValid = false;
            entry.inUse = false;
            this.allocated--;
          }
        }
      }
    }

    logger.warn('Attempted to release object not found in pool');
  }

  /**
   * Clear all objects from the pool
   */
  clear(): void {
    this.pool = [];
    this.allocated = 0;
    this.totalDestroyed += this.pool.length;

    logger.info('Object pool cleared', {
      totalDestroyed: this.totalDestroyed,
    });
  }

  /**
   * Get current pool size
   */
  getSize(): number {
    return this.pool.length;
  }

  /**
   * Get number of allocated objects
   */
  getAllocated(): number {
    return this.allocated;
  }

  /**
   * Get number of available objects
   */
  getAvailable(): number {
    return this.pool.filter(entry => !entry.inUse && entry.isValid).length;
  }

  /**
   * Get comprehensive pool statistics
   */
  getStats(): ObjectPoolStats {
    const available = this.getAvailable();
    const utilization =
      this.pool.length > 0 ? (this.allocated / this.pool.length) * 100 : 0;

    // Calculate average object age
    let totalAge = 0;
    let validObjects = 0;

    for (const entry of this.pool) {
      if (entry.isValid) {
        totalAge += Date.now() - entry.createdAt;
        validObjects++;
      }
    }

    const averageAge = validObjects > 0 ? totalAge / validObjects : 0;

    // Calculate efficiency (hits vs misses)
    const efficiency =
      this.totalCreated > 0
        ? ((this.totalCreated - this.pool.length) / this.totalCreated) * 100
        : 0;

    return {
      size: this.pool.length,
      allocated: this.allocated,
      available,
      totalCreated: this.totalCreated,
      totalDestroyed: this.totalDestroyed,
      utilization,
      averageAge,
      efficiency,
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
    const cutoffTime = now - this.config.maxObjectAge;
    let cleanedCount = 0;

    // Remove old, unused objects
    const filteredPool = this.pool.filter(entry => {
      if (!entry.inUse && entry.createdAt < cutoffTime) {
        cleanedCount++;
        return false;
      }
      return true;
    });

    if (cleanedCount > 0) {
      this.pool = filteredPool;
      this.totalDestroyed += cleanedCount;

      logger.info('Pool cleanup completed', {
        cleanedCount,
        remainingSize: this.pool.length,
        totalDestroyed: this.totalDestroyed,
      });

      this.updateStats();
    }

    // Replenish pool if needed
    const targetSize = Math.max(this.config.initialSize, this.allocated * 2);
    while (
      this.pool.length < targetSize &&
      this.pool.length < this.config.maxSize
    ) {
      this.createPoolEntry();
    }
  }

  /**
   * Update monitoring statistics
   */
  private updateStats(): void {
    if (this.config.enableMonitoring) {
      const stats = this.getStats();
      logger.debug('Object pool stats updated', { stats });
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

    // Check utilization
    if (stats.utilization > 90) {
      issues.push('High pool utilization');
      recommendations.push(
        'Consider increasing pool size or reducing object usage'
      );
    }

    // Check efficiency
    if (stats.efficiency < 50) {
      issues.push('Low pool efficiency');
      recommendations.push(
        'Review object lifecycle and reset/validation functions'
      );
    }

    // Check object age
    if (stats.averageAge > this.config.maxObjectAge) {
      issues.push('Objects are aging out frequently');
      recommendations.push('Review maxObjectAge configuration');
    }

    const healthy = issues.length === 0;

    return {
      healthy,
      issues,
      recommendations,
    };
  }

  /**
   * Shutdown the object pool
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

    // Clear all objects
    this.clear();

    logger.info('ObjectPool shutdown completed');
  }
}
