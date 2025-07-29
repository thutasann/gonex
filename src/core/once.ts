/**
 * Options for configuring Once behavior
 */
export type OnceOptions = {
  /** Optional name for debugging and error reporting */
  name?: string;
};

/**
 * High-performance one-time initialization primitive
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast execution path for completed initialization
 * - Efficient concurrent access handling
 * - Lock-free operations after initialization
 *
 * Similar to Go's sync.Once but adapted for Node.js with error handling
 */
export class Once {
  private done = false;
  private executing = false;
  private waitQueue: Array<{
    name: string;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private readonly name?: string;

  constructor(options: OnceOptions = {}) {
    const { name } = options;
    this.name = name || '';
  }

  /**
   * Execute function exactly once
   *
   * Fast path optimization for completed initialization
   *
   * @param fn - Function to execute exactly once
   * @returns Promise that resolves when initialization is complete
   */
  async do(fn: () => void | Promise<void>): Promise<void> {
    // Fast path: already done
    if (this.done) {
      return;
    }

    // Fast path: currently executing, wait for completion
    if (this.executing) {
      return new Promise<void>((resolve, reject) => {
        this.waitQueue.push({ name: this.name || '', resolve, reject });
      });
    }

    // Slow path: start execution
    this.executing = true;

    try {
      const result = fn();

      // Handle both synchronous and asynchronous functions
      if (result instanceof Promise) {
        await result;
      }

      // Mark as done
      this.done = true;

      // Resolve all waiting promises
      for (const waiter of this.waitQueue) {
        waiter.resolve();
      }
      this.waitQueue.length = 0; // Clear array efficiently
    } catch (error) {
      // Reset state on error
      this.executing = false;

      // Reject all waiting promises
      for (const waiter of this.waitQueue) {
        waiter.reject(
          error instanceof Error ? error : new Error(String(error))
        );
      }
      this.waitQueue.length = 0; // Clear array efficiently

      throw error;
    }
  }

  /**
   * Check if initialization is complete
   *
   * @returns true if initialization is complete, false otherwise
   */
  isDone(): boolean {
    return this.done;
  }

  /**
   * Check if initialization is currently executing
   *
   * @returns true if initialization is currently executing, false otherwise
   */
  isExecuting(): boolean {
    return this.executing;
  }

  /**
   * Reset the Once to initial state
   *
   * Clears completion state and waiting queue
   * Useful for testing or reusing the instance
   */
  reset(): void {
    this.done = false;
    this.executing = false;
    this.waitQueue.length = 0; // Clear array efficiently
  }
}

/**
 * Create a new Once with the specified options
 *
 * Factory function for creating Once instances
 *
 * @param options - Once configuration options
 * @returns A new Once instance
 *
 * @example
 * ```typescript
 * // Basic Once
 * const once = new Once();
 *
 * // Once with name for debugging
 * const once = new Once({ name: 'database-init' });
 *
 * // Usage example
 * for (let i = 0; i < 5; i++) {
 *   go(async () => {
 *     await once.do(async () => {
 *       console.log('Initializing...');
 *       await sleep(1000);
 *       console.log('Initialized!');
 *     });
 *   });
 * }
 * // Only one goroutine will execute the initialization
 * ```
 */
export function once(options?: OnceOptions): Once {
  return new Once(options);
}
