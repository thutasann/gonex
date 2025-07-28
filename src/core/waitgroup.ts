import {
  createTimeoutPromise,
  DEFAULT_TIMEOUT,
  INFINITE_TIMEOUT,
  validateTimeout,
  WaitGroupNegativeCounterError,
} from '../utils';

/**
 * Options for configuring WaitGroup behavior
 */
export type WaitGroupOptions = {
  /** Timeout in milliseconds for wait operations (-1 for infinite) */
  timeout?: number;
  /** Optional name for debugging and error reporting */
  name?: string;
};

/**
 * High-performance synchronization primitive for multiple goroutines
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast counter operations
 * - Efficient error aggregation
 * - Lock-free operations where possible
 *
 * Similar to Go's sync.WaitGroup but adapted for Node.js with error handling
 */
export class WaitGroup {
  private counter = 0;
  private waitPromise: Promise<void> | null = null;
  private waitResolve: (() => void) | null = null;
  private waitReject: ((error: Error) => void) | null = null;
  private errors: Error[] = [];
  private readonly timeout: number;
  private readonly name?: string;

  constructor(options: WaitGroupOptions = {}) {
    const { timeout = DEFAULT_TIMEOUT, name } = options;

    // Validate timeout if provided
    if (timeout !== undefined) {
      validateTimeout(timeout, name);
    }

    this.timeout = timeout;
    this.name = name || '';
  }

  /**
   * Add delta to the counter
   *
   * Fast path operation with minimal overhead
   *
   * @param delta - Number to add to the counter (can be negative)
   * @throws {WaitGroupNegativeCounterError} When counter would become negative
   */
  add(delta: number): void {
    // Fast validation
    if (typeof delta !== 'number' || isNaN(delta)) {
      throw new WaitGroupNegativeCounterError(delta);
    }

    const newCounter = this.counter + delta;

    // Check for negative counter
    if (newCounter < 0) {
      throw new WaitGroupNegativeCounterError(newCounter);
    }

    this.counter = newCounter;

    // Fast path: if counter reaches zero, resolve wait promise immediately
    if (this.counter === 0 && this.waitResolve) {
      this.waitResolve();
      this.resetWaitPromise();
    }
  }

  /**
   * Decrement the counter by 1
   *
   * Convenience method for common case
   */
  done(): void {
    this.add(-1);
  }

  /**
   * Wait for the counter to reach zero
   *
   * Optimized with fast paths and efficient promise management
   *
   * @param timeout - Optional timeout override in milliseconds
   * @returns Promise that resolves when counter reaches zero
   * @throws {Error} When timeout is exceeded or errors are collected
   */
  async wait(timeout?: number): Promise<void> {
    const operationTimeout = timeout ?? this.timeout;

    // Fast path: counter is already zero
    if (this.counter === 0) {
      return;
    }

    // Create wait promise if it doesn't exist
    if (!this.waitPromise) {
      this.waitPromise = new Promise<void>((resolve, reject) => {
        this.waitResolve = resolve;
        this.waitReject = reject;
      });
    }

    let promise = this.waitPromise;

    // Add timeout if specified
    if (operationTimeout !== INFINITE_TIMEOUT) {
      promise = createTimeoutPromise(promise, operationTimeout);
    }

    try {
      await promise;

      // Check for collected errors
      if (this.errors.length > 0) {
        if (this.errors.length === 1) {
          throw this.errors[0];
        } else {
          // Create aggregated error
          const errorMessage = `WaitGroup completed with ${this.errors.length} errors`;
          const aggregatedError = new Error(errorMessage);
          (aggregatedError as AnyValue).errors = this.errors;
          throw aggregatedError;
        }
      }
    } catch (error) {
      // Reset wait promise on error
      this.resetWaitPromise();
      throw error;
    }
  }

  /**
   * Get the current counter value
   *
   * @returns Current counter value
   */
  count(): number {
    return this.counter;
  }

  /**
   * Add an error to be collected and thrown when wait completes
   *
   * This allows goroutines to report errors that will be aggregated
   * and thrown when the WaitGroup completes.
   *
   * @param error - Error to collect
   */
  addError(error: Error): void {
    this.errors.push(error);
  }

  /**
   * Get all collected errors
   *
   * @returns Array of collected errors
   */
  getErrors(): Error[] {
    return [...this.errors];
  }

  /**
   * Clear all collected errors
   *
   * Useful for reusing a WaitGroup
   */
  clearErrors(): void {
    this.errors.length = 0;
  }

  /**
   * Reset the WaitGroup to initial state
   *
   * Clears counter, errors, and wait promise
   * Useful for reusing a WaitGroup instance
   */
  reset(): void {
    this.counter = 0;
    this.errors.length = 0;
    this.resetWaitPromise();
  }

  /**
   * Reset the wait promise to null
   *
   * Internal method for cleanup
   */
  private resetWaitPromise(): void {
    this.waitPromise = null;
    this.waitResolve = null;
    this.waitReject = null;
  }
}

/**
 * Create a new WaitGroup with the specified options
 *
 * Factory function for creating WaitGroup instances
 *
 * @param options - WaitGroup configuration options
 * @returns A new WaitGroup instance
 *
 * @example
 * ```typescript
 * // Basic WaitGroup
 * const wg = waitGroup();
 *
 * // WaitGroup with timeout
 * const wg = waitGroup({ timeout: 5000 });
 *
 * // WaitGroup with name for debugging
 * const wg = waitGroup({ name: 'worker-pool' });
 * ```
 */
export function waitGroup(options?: WaitGroupOptions): WaitGroup {
  return new WaitGroup(options);
}
