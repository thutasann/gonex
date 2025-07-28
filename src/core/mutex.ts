import {
  DEFAULT_MUTEX_TIMEOUT,
  INFINITE_TIMEOUT,
  MutexAlreadyLockedError,
  createTimeoutPromise,
  validateTimeout,
} from '../utils';

/**
 * Options for configuring Mutex behavior
 */
export type MutexOptions = {
  /** Timeout in milliseconds for lock acquisition (-1 for infinite) */
  timeout?: number;
  /** Optional name for debugging and error reporting */
  name?: string;
};

/**
 * High-performance mutual exclusion lock
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast lock/unlock operations
 * - Efficient timeout handling
 * - Lock-free tryLock operations
 *
 * Similar to Go's sync.Mutex but adapted for Node.js with timeout support
 */
class Mutex {
  private locked = false;
  private lockPromise: Promise<void> | null = null;
  private lockResolve: (() => void) | null = null;
  private lockReject: ((err: Error) => void) | null = null;
  private readonly timeout: number;
  private readonly name?: string;

  constructor(options: MutexOptions = {}) {
    const { timeout = DEFAULT_MUTEX_TIMEOUT, name } = options;

    // Validate timeout if provided
    if (timeout !== undefined) {
      validateTimeout(timeout, name);
    }

    this.timeout = timeout;
    this.name = name || '';
  }

  /**
   * Acquire the lock (blocking)
   *
   * Fast path optimization for uncontended locks
   *
   * @param timeout - Optional timeout override in milliseconds
   * @returns Promise that resolves when lock is acquired
   * @throws {MutexLockTimeoutError} When lock acquisition times out
   */
  async lock(timeout?: number): Promise<void> {
    const operationTimeout = timeout ?? this.timeout;

    // Fast path: lock is available
    if (!this.locked) {
      this.locked = true;
      return;
    }

    // Create lock promise if it doesn't exist
    if (!this.lockPromise) {
      this.lockPromise = new Promise<void>((resolve, reject) => {
        this.lockResolve = resolve;
        this.lockReject = reject;
      });
    }

    let promise = this.lockPromise;

    if (operationTimeout !== INFINITE_TIMEOUT) {
      promise = createTimeoutPromise(promise, operationTimeout);
    }

    try {
      await promise;
    } catch (error) {
      // Reset lock promise on error
      this.resetLockPromise();
      throw error;
    }
  }

  /**
   * Try to acquire the lock without blocking
   *
   * Fast path operation with minimal overhead
   *
   * @returns true if lock was acquired, false otherwise
   */
  tryLock(): boolean {
    if (this.locked) {
      return false;
    }

    this.locked = true;
    return true;
  }

  /**
   * Release the lock
   *
   * Fast path operation with immediate wakeup of waiting goroutines
   */
  unlock(): void {
    if (!this.locked) {
      throw new MutexAlreadyLockedError(this.name);
    }

    this.locked = false;

    // Fast path: wake up waiting goroutine immediately
    if (this.lockResolve) {
      this.lockResolve();
      this.resetLockPromise();
    }
  }

  /**
   * Check if the lock is currently held
   *
   * @returns true if lock is held, false otherwise
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Reset the lock promise to null
   *
   * Internal method for cleanup
   */
  private resetLockPromise(): void {
    this.lockPromise = null;
    this.lockResolve = null;
    this.lockReject = null;
  }
}

/**
 * Create a new Mutex with the specified options
 *
 * Factory function for creating Mutex instances
 *
 * @param options - Mutex configuration options
 * @returns A new Mutex instance
 *
 * @example
 * ```typescript
 * // Basic Mutex
 * const mutex = new Mutex();
 *
 * // Mutex with timeout
 * const mutex = new Mutex({ timeout: 3000 });
 *
 * // Mutex with name for debugging
 * const mutex = new Mutex({ name: 'shared-resource' });
 * ```
 */
export function mutex(options?: MutexOptions): Mutex {
  return new Mutex(options);
}
