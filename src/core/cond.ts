import { DEFAULT_TIMEOUT, INFINITE_TIMEOUT, validateTimeout } from '../utils';
import { Mutex, type MutexOptions } from './mutex';

/**
 * Options for configuring Cond behavior
 */
export type CondOptions = {
  /** Timeout in milliseconds for wait operations (-1 for infinite) */
  timeout?: number;
  /** Optional name for debugging and error reporting */
  name?: string;
};

/**
 * Locker interface that must be implemented by the mutex passed to Cond
 */
export interface Locker {
  lock(): Promise<void> | void;
  unlock(): void;
}

/**
 * High-performance condition variable implementation
 *
 * A Cond implements a condition variable, a rendezvous point for goroutines
 * waiting for or announcing the occurrence of an event.
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast signal/broadcast operations
 * - Efficient wait queue management
 * - Lock-free operations where possible
 *
 * Similar to Go's sync.Cond but adapted for Node.js with timeout support
 *
 * Each Cond has an associated Locker L (often a Mutex or RWMutex), which
 * must be held when changing the condition and when calling the Wait method.
 */
export class Cond {
  private readonly locker: Locker;
  private waitQueue: Array<{
    resolve: (value: void | PromiseLike<void>) => void;
    reject: (reason?: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];
  private readonly timeout: number;
  private readonly name?: string;

  /**
   * Create a new Cond with the given Locker
   *
   * @param locker - The mutex that protects the condition
   * @param options - Configuration options
   */
  constructor(locker: Locker, options: CondOptions = {}) {
    const { timeout = DEFAULT_TIMEOUT, name } = options;

    // Validate timeout if provided
    if (timeout !== undefined) {
      validateTimeout(timeout, name);
    }

    this.locker = locker;
    this.timeout = timeout;
    this.name = name || '';
  }

  /**
   * Wait atomically unlocks the associated Locker and suspends execution
   * of the calling goroutine. After later resuming execution, Wait locks
   * the Locker before returning.
   *
   * Unlike in other systems, Wait cannot return unless awoken by Broadcast or Signal.
   *
   * Because the Locker is not locked when Wait first resumes, the caller
   * typically cannot assume that the condition is true when Wait returns.
   * Instead, the caller should Wait in a loop:
   *
   * ```typescript
   * cond.locker.lock();
   * while (!condition()) {
   *   await cond.wait();
   * }
   * // ... make use of condition ...
   * cond.locker.unlock();
   * ```
   *
   * @param timeout - Optional timeout override in milliseconds
   * @returns Promise that resolves when signaled or broadcast
   * @throws {Error} When timeout is exceeded
   */
  async wait(timeout?: number): Promise<void> {
    const operationTimeout = timeout ?? this.timeout;

    // Create wait promise
    const waitPromise = new Promise<void>((resolve, reject) => {
      const waiter: {
        resolve: (value: void | PromiseLike<void>) => void;
        reject: (reason?: Error) => void;
        timeoutId?: NodeJS.Timeout;
      } = {
        resolve,
        reject,
      };

      // Add timeout if specified
      if (operationTimeout !== INFINITE_TIMEOUT) {
        waiter.timeoutId = setTimeout(() => {
          // Remove from queue
          const index = this.waitQueue.indexOf(waiter);
          if (index > -1) {
            this.waitQueue.splice(index, 1);
          }
          reject(
            new Error(
              `Cond wait timed out after ${operationTimeout}ms${this.name ? ` on "${this.name}"` : ''}`
            )
          );
        }, operationTimeout);
      }

      this.waitQueue.push(waiter);
    });

    // Unlock the mutex before waiting
    this.locker.unlock();

    try {
      // Wait for signal or broadcast
      await waitPromise;
    } finally {
      // Re-acquire the mutex before returning
      await this.locker.lock();
    }
  }

  /**
   * Signal wakes one goroutine waiting on the Cond, if any.
   *
   * It is allowed but not required for the caller to hold the Locker
   * during the call.
   *
   * Signal() does not affect goroutine scheduling priority; if other goroutines
   * are attempting to lock the Locker, they may be scheduled before a "woken"
   * goroutine.
   */
  signal(): void {
    // Fast path: no waiters
    if (this.waitQueue.length === 0) {
      return;
    }

    // Wake up one waiter (FIFO order)
    const waiter = this.waitQueue.shift();
    if (waiter) {
      // Clear timeout if it exists
      if (waiter.timeoutId) {
        clearTimeout(waiter.timeoutId);
      }
      waiter.resolve();
    }
  }

  /**
   * Broadcast wakes all goroutines waiting on the Cond.
   *
   * It is allowed but not required for the caller to hold the Locker
   * during the call.
   */
  broadcast(): void {
    // Fast path: no waiters
    if (this.waitQueue.length === 0) {
      return;
    }

    // Wake up all waiters
    const waiters = this.waitQueue.splice(0);
    for (const waiter of waiters) {
      // Clear timeout if it exists
      if (waiter.timeoutId) {
        clearTimeout(waiter.timeoutId);
      }
      waiter.resolve();
    }
  }

  /**
   * Get the number of goroutines currently waiting
   *
   * @returns Number of waiting goroutines
   */
  waiters(): number {
    return this.waitQueue.length;
  }

  /**
   * Get the associated locker
   *
   * @returns The locker associated with this condition variable
   */
  getLocker(): Locker {
    return this.locker;
  }
}

/**
 * Create a new Cond with the specified locker and options
 *
 * Factory function for creating Cond instances
 *
 * @param locker - The mutex that protects the condition
 * @param options - Cond configuration options
 * @returns A new Cond instance
 *
 * @example
 * ```typescript
 * // Basic Cond with Mutex
 * const mutex = new Mutex();
 * const cond = newCond(mutex);
 *
 * // Cond with timeout
 * const cond = newCond(mutex, { timeout: 3000 });
 *
 * // Cond with name for debugging
 * const cond = newCond(mutex, { name: 'buffer-not-empty' });
 *
 * // Typical usage pattern
 * let ready = false;
 * const mutex = new Mutex();
 * const cond = newCond(mutex);
 *
 * // Producer
 * go(async () => {
 *   await mutex.lock();
 *   ready = true;
 *   cond.signal();
 *   mutex.unlock();
 * });
 *
 * // Consumer
 * go(async () => {
 *   await mutex.lock();
 *   while (!ready) {
 *     await cond.wait();
 *   }
 *   // ... use the resource ...
 *   mutex.unlock();
 * });
 * ```
 */
export function newCond(locker: Locker, options?: CondOptions): Cond {
  return new Cond(locker, options);
}

/**
 * Convenience function to create a Cond with a new Mutex
 *
 * @param options - Cond configuration options
 * @returns A new Cond instance with a new Mutex
 *
 * @example
 * ```typescript
 * // Create Cond with internal Mutex
 * const cond = cond();
 *
 * // With options
 * const cond = cond({ timeout: 5000, name: 'worker-ready' });
 * ```
 */
export function cond(options?: CondOptions): Cond {
  const mutexOptions: MutexOptions = {};

  if (options?.timeout !== undefined) {
    mutexOptions.timeout = options.timeout;
  }

  if (options?.name) {
    mutexOptions.name = `${options.name}-mutex`;
  }

  const mutex = new Mutex(mutexOptions);
  return new Cond(mutex, options);
}
