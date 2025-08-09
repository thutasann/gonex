import {
  DEFAULT_SEMAPHORE_TIMEOUT,
  INFINITE_TIMEOUT,
  SemaphoreTimeoutError,
  validateConcurrencyLevel,
  validateTimeout,
} from '../utils';

/**
 * Options for configuring Semaphore behavior
 */
export type SemaphoreOptions = {
  /** Number of permits (concurrent access limit) */
  permits: number;
  /** Timeout in milliseconds for permit acquisition (-1 for infinite) */
  timeout?: number;
  /** Optional name for debugging and error reporting */
  name?: string;
};

/**
 * High-performance semaphore for resource limiting
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast acquire/release operations
 * - Efficient permit management
 * - Lock-free tryAcquire operations
 *
 * Similar to Go's sync.Semaphore but adapted for Node.js with timeout support
 */
export class Semaphore {
  private availablePermits: number;
  private acquireQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];
  private readonly maxPermits: number;
  private readonly timeout: number;
  private readonly name?: string;

  constructor(options: SemaphoreOptions) {
    const { permits, timeout = DEFAULT_SEMAPHORE_TIMEOUT, name } = options;

    // Validate options
    validateConcurrencyLevel(permits, name);
    if (timeout !== undefined) {
      validateTimeout(timeout, name);
    }

    this.maxPermits = permits;
    this.availablePermits = permits;
    this.timeout = timeout;
    this.name = name || '';
  }

  /**
   * Acquire a permit (blocking)
   *
   * Fast path optimization for available permits
   *
   * @param timeout - Optional timeout override in milliseconds
   * @returns Promise that resolves when permit is acquired
   * @throws {SemaphoreTimeoutError} When permit acquisition times out
   */
  async acquire(timeout?: number): Promise<void> {
    const operationTimeout = timeout ?? this.timeout;

    // Fast path: permit is available
    if (this.availablePermits > 0) {
      this.availablePermits--;
      return;
    }

    // Slow path: queue the acquire operation
    return new Promise<void>((resolve, reject) => {
      const acquireOperation: AnyValue = {
        resolve,
        reject,
      };
      this.acquireQueue.push(acquireOperation);

      // Add timeout if specified
      if (operationTimeout !== INFINITE_TIMEOUT) {
        acquireOperation.timeoutId = setTimeout(() => {
          const index = this.acquireQueue.indexOf(acquireOperation);
          if (index > -1) {
            this.acquireQueue.splice(index, 1);
            reject(new SemaphoreTimeoutError(operationTimeout, this.name));
          }
        }, operationTimeout);
      }
    });
  }

  /**
   * Try to acquire a permit without blocking
   *
   * Fast path operation with minimal overhead
   *
   * @returns true if permit was acquired, false otherwise
   */
  tryAcquire(): boolean {
    if (this.availablePermits > 0) {
      this.availablePermits--;
      return true;
    }
    return false;
  }

  /**
   * Release a permit
   *
   * Fast path operation with immediate wakeup of waiting goroutines
   */
  release(): void {
    // Fast path: wake up waiting goroutine immediately
    if (this.acquireQueue.length > 0) {
      const acquireOp = this.acquireQueue.shift()!;
      if (acquireOp.timeoutId) {
        clearTimeout(acquireOp.timeoutId);
      }
      acquireOp.resolve();
      return;
    }

    // Otherwise, increase available permits
    if (this.availablePermits < this.maxPermits) {
      this.availablePermits++;
    }
  }

  /**
   * Get the number of available permits
   *
   * @returns Number of permits currently available
   */
  getAvailablePermits(): number {
    return this.availablePermits;
  }

  /**
   * Get the maximum number of permits
   *
   * @returns Maximum number of permits
   */
  getMaxPermits(): number {
    return this.maxPermits;
  }

  /**
   * Get the number of waiting goroutines
   *
   * @returns Number of goroutines waiting for permits
   */
  waitingCount(): number {
    return this.acquireQueue.length;
  }

  /**
   * Check if the semaphore is fully utilized
   *
   * @returns true if no permits are available, false otherwise
   */
  isFullyUtilized(): boolean {
    return this.availablePermits === 0;
  }

  /**
   * Reset the semaphore to its initial state
   *
   * Clears all waiting operations and resets available permits
   */
  reset(): void {
    // Reject all waiting operations
    for (const acquireOp of this.acquireQueue) {
      if (acquireOp.timeoutId) {
        clearTimeout(acquireOp.timeoutId);
      }
      acquireOp.reject(new Error('Semaphore reset'));
    }
    this.acquireQueue.length = 0; // Clear array efficiently

    // Reset available permits
    this.availablePermits = this.maxPermits;
  }
}

/**
 * Create a new Semaphore with the specified options
 *
 * Factory function for creating Semaphore instances
 *
 * @param options - Semaphore configuration options
 * @returns A new Semaphore instance
 *
 * @example
 * ```typescript
 * // Basic semaphore with 3 permits
 * const semaphore = new Semaphore({ permits: 3 });
 *
 * // Semaphore with timeout
 * const semaphore = new Semaphore({
 *   permits: 5,
 *   timeout: 2000
 * });
 *
 * // Semaphore with name for debugging
 * const semaphore = new Semaphore({
 *   permits: 10,
 *   name: 'database-connections'
 * });
 * ```
 */
export function semaphore(options: SemaphoreOptions): Semaphore {
  return new Semaphore(options);
}
