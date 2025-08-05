/**
 * Function registry for worker thread communication
 *
 * This system allows us to register functions with unique IDs and pass those IDs
 * to worker threads instead of serializing the functions. This avoids serialization
 * issues and provides better performance.
 */

export type FunctionRegistryEntry = {
  id: string;
  fn: (...args: AnyValue[]) => AnyValue;
  dependencies?: Record<string, (...args: AnyValue[]) => AnyValue>;
  createdAt: number;
  lastUsed: number;
  useCount: number;
};

/**
 * Function registry for managing functions across worker threads
 */
export class FunctionRegistry {
  private functions: Map<string, FunctionRegistryEntry> = new Map();
  private nextId = 1;
  private maxFunctions = 1000; // Prevent memory leaks
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Register a function and return its ID
   *
   * @param fn - Function to register
   * @param dependencies - Optional dependencies
   * @returns Function ID
   */
  register(
    fn: (...args: AnyValue[]) => AnyValue,
    dependencies?: Record<string, (...args: AnyValue[]) => AnyValue>
  ): string {
    const id = `fn_${this.nextId++}_${Date.now()}`;

    this.functions.set(id, {
      id,
      fn,
      dependencies: dependencies || {},
      createdAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 0,
    });

    // Cleanup if we have too many functions
    if (this.functions.size > this.maxFunctions) {
      this.cleanup();
    }

    return id;
  }

  /**
   * Get a function by ID
   *
   * @param id - Function ID
   * @returns Function entry or null if not found
   */
  get(id: string): FunctionRegistryEntry | null {
    const entry = this.functions.get(id);
    if (entry) {
      entry.lastUsed = Date.now();
      entry.useCount++;
    }
    return entry || null;
  }

  /**
   * Execute a function by ID
   *
   * @param id - Function ID
   * @param args - Arguments to pass to the function
   * @returns Function result
   */
  async execute(id: string, args: AnyValue[] = []): Promise<AnyValue> {
    const entry = this.get(id);
    if (!entry) {
      throw new Error(`Function with ID ${id} not found`);
    }

    const result = entry.fn(...args);
    if (result instanceof Promise) {
      return await result;
    }
    return result;
  }

  /**
   * Unregister a function
   *
   * @param id - Function ID
   */
  unregister(id: string): boolean {
    return this.functions.delete(id);
  }

  /**
   * Cleanup old and unused functions
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    const minUseCount = 1;

    for (const [id, entry] of this.functions.entries()) {
      const age = now - entry.lastUsed;
      if (age > maxAge && entry.useCount < minUseCount) {
        this.functions.delete(id);
      }
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalFunctions: number;
    oldestFunction: number;
    newestFunction: number;
  } {
    if (this.functions.size === 0) {
      return {
        totalFunctions: 0,
        oldestFunction: 0,
        newestFunction: 0,
      };
    }

    const timestamps = Array.from(this.functions.values()).map(
      entry => entry.createdAt
    );
    return {
      totalFunctions: this.functions.size,
      oldestFunction: Math.min(...timestamps),
      newestFunction: Math.max(...timestamps),
    };
  }

  /**
   * Shutdown the registry
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.functions.clear();
  }
}

/**
 * Global function registry instance
 */
export const globalFunctionRegistry = new FunctionRegistry();
