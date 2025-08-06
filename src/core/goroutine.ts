import {
  createCancellablePromise,
  createTimeoutPromise,
  log,
  validateTimeout,
} from '../utils';
import { logger } from '../utils/logger';
import { sleep } from './timing';
import {
  ParallelOptions,
  ParallelScheduler,
} from './worker/parallel-scheduler';

/**
 * Global parallel scheduler instance
 */
let globalParallelScheduler: ParallelScheduler | null = null;

/**
 * Initialize the global parallel scheduler
 *
 * @param options - Parallel scheduler options
 */
export async function initializeParallelScheduler(
  options: ParallelOptions = {}
): Promise<void> {
  if (!globalParallelScheduler) {
    globalParallelScheduler = new ParallelScheduler(options);
    await globalParallelScheduler.initialize(options);
  }
}

/**
 * Get the global parallel scheduler instance
 */
export function getParallelScheduler(): ParallelScheduler | null {
  return globalParallelScheduler;
}

/**
 * Options for configuring goroutine behavior
 */
export type GoroutineOptions = {
  /** Optional name for debugging and error reporting */
  name?: string;

  /** Timeout in milliseconds for the goroutine execution (-1 for infinite) */
  timeout?: number;

  /** Custom error handler called when the goroutine encounters an error */
  onError?: (error: Error) => void;

  /** AbortSignal for cancelling the goroutine execution */
  signal?: AbortSignal;

  /** Use worker threads for true parallelism */
  useWorkerThreads?: boolean;

  /** Parallel execution options */
  parallel?: ParallelOptions;
};

/**
 * Execute a function as a goroutine (lightweight concurrent function)
 *
 * This function provides Go-like goroutine semantics adapted for Node.js:
 * - Non-blocking execution using the event loop
 * - Proper error handling and propagation
 * - Support for timeouts and cancellation
 * - Resource cleanup and memory management
 * - Optional true parallelism using worker threads
 *
 * @param fn - Function to execute asynchronously (can be sync or async)
 * @param args - Arguments to pass to the function
 * @param options - Optional configuration for the goroutine
 * @returns Promise that resolves with the function result or rejects with an error
 *
 * @example
 * ```typescript
 * // Basic goroutine
 * const result = await go(() => "Hello from goroutine!");
 *
 * // Async goroutine with arguments
 * const result = await go(
 *   async (a, b) => {
 *     const data = await fetchData();
 *     return processData(data, a, b);
 *   },
 *   [1, 2],
 *   {
 *     onError: (error) => console.error("Goroutine failed:", error)
 *   }
 * );
 *
 * // Goroutine with true parallelism using worker threads
 * const result = await go(
 *   (x, y) => heavyComputation(x, y),
 *   [10, 20],
 *   {
 *     useWorkerThreads: true,
 *     parallel: { threadCount: 4 }
 *   }
 * );
 * ```
 */
export async function go<T>(
  fn: (...args: AnyValue[]) => T | Promise<T>,
  args: AnyValue[] = [],
  options: GoroutineOptions = {}
): Promise<T> {
  const {
    name,
    timeout,
    onError,
    signal,
    useWorkerThreads = false,
    parallel = {},
  } = options;

  // Set the logger execution mode
  logger.setExecutionMode(
    useWorkerThreads && globalParallelScheduler ? 'worker-thread' : 'event-loop'
  );

  // Validate timeout if provided
  if (timeout !== undefined) {
    validateTimeout(timeout, name);
  }

  /**
   * Main execution function that handles both sync and async functions
   * and provides proper error handling
   */
  const executeFn = async (): Promise<T> => {
    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return await result;
      } else {
        return result;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  };

  // Use parallel scheduler if worker threads are enabled
  if (useWorkerThreads && globalParallelScheduler) {
    const parallelOptions = {
      useWorkerThreads: true,
      ...parallel,
    };

    // Only add timeout if it's defined
    if (timeout !== undefined) {
      parallelOptions.timeout = timeout;
    }

    try {
      // Send the original function directly, not the wrapped executeFn
      const result = await globalParallelScheduler.go(
        fn,
        args,
        parallelOptions
      );
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (onError) {
        onError(err);
      }

      throw err;
    }
  }

  // Fallback to single-threaded execution
  let promise = executeFn();

  // Add timeout wrapper if specified (and not infinite)
  if (timeout !== undefined && timeout !== -1) {
    promise = createTimeoutPromise(promise, timeout);
  }

  // Add cancellation support if signal provided
  if (signal) {
    promise = createCancellablePromise(promise, signal);
  }

  // Execute on next tick to ensure non-blocking behavior
  // This prevents blocking the current execution context
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    setImmediate(() => {
      promise
        .then(result => {
          resolve(result);
        })
        .catch(error => {
          const duration = Date.now() - startTime;
          const err = error instanceof Error ? error : new Error(String(error));

          if (onError) {
            onError(err);
          }

          log.error(`Goroutine failed${name ? `: ${name}` : ''}`, err, {
            duration: `${duration}ms`,
            useWorkerThreads,
          });
          reject(err);
        });
    });
  });
}

/**
 * Execute multiple goroutines concurrently and wait for all to complete
 *
 * This is similar to Promise.all() but with goroutine semantics.
 * If any goroutine fails, the entire operation fails.
 * Supports true parallelism using worker threads.
 *
 * @param fns - Array of functions to execute concurrently
 * @param argsArray - Array of argument arrays for each function
 * @param options - Options applied to all goroutines
 * @returns Promise that resolves with array of results in the same order as input
 *
 * @example
 * ```typescript
 * const results = await goAll([
 *   (id) => fetchUser(id),
 *   (id) => fetchUser(id),
 *   (id) => fetchUser(id)
 * ], [[1], [2], [3]]);
 * // results = [user1, user2, user3]
 *
 * // With true parallelism
 * const results = await goAll([
 *   (x) => heavyComputation1(x),
 *   (x) => heavyComputation2(x),
 *   (x) => heavyComputation3(x)
 * ], [[10], [20], [30]], { useWorkerThreads: true });
 * ```
 */
export async function goAll<T>(
  fns: Array<(...args: AnyValue[]) => T | Promise<T>>,
  argsArray: AnyValue[][] = [],
  options: GoroutineOptions = {}
): Promise<T[]> {
  const { useWorkerThreads = false, parallel = {} } = options;

  // Use parallel scheduler if worker threads are enabled
  if (useWorkerThreads && globalParallelScheduler) {
    const parallelOptions = {
      useWorkerThreads: true,
      ...parallel,
    };

    // Only add timeout if it's defined
    if (options.timeout !== undefined) {
      parallelOptions.timeout = options.timeout;
    }

    return globalParallelScheduler.goAll(fns, argsArray, parallelOptions);
  }

  // Fallback to single-threaded execution
  const promises = fns.map((fn, index) =>
    go(fn, argsArray[index] || [], options)
  );
  return Promise.all(promises);
}

/**
 * Execute multiple goroutines concurrently and return the first result
 *
 * This is similar to Promise.race() but with goroutine semantics.
 * The first goroutine to complete (success or failure) determines the result.
 * Supports true parallelism using worker threads.
 *
 * @param fns - Array of functions to execute concurrently
 * @param argsArray - Array of argument arrays for each function
 * @param options - Options applied to all goroutines
 * @returns Promise that resolves with the first result or rejects with the first error
 *
 * @example
 * ```typescript
 * const result = await goRace([
 *   () => fetchFromCache(),
 *   () => fetchFromDatabase(),
 *   () => fetchFromAPI()
 * ]);
 * // Returns the fastest result
 *
 * // With true parallelism
 * const result = await goRace([
 *   (x) => searchAlgorithm1(x),
 *   (x) => searchAlgorithm2(x),
 *   (x) => searchAlgorithm3(x)
 * ], [[10], [20], [30]], { useWorkerThreads: true });
 * ```
 */
export async function goRace<T>(
  fns: Array<(...args: AnyValue[]) => T | Promise<T>>,
  argsArray: AnyValue[][] = [],
  options: GoroutineOptions = {}
): Promise<T> {
  const { useWorkerThreads = false, parallel = {} } = options;

  // Use parallel scheduler if worker threads are enabled
  if (useWorkerThreads && globalParallelScheduler) {
    const parallelOptions = {
      useWorkerThreads: true,
      ...parallel,
    };

    // Only add timeout if it's defined
    if (options.timeout !== undefined) {
      parallelOptions.timeout = options.timeout;
    }

    return globalParallelScheduler.goRace(fns, argsArray, parallelOptions);
  }

  // Fallback to single-threaded execution
  const promises = fns.map((fn, index) =>
    go(fn, argsArray[index] || [], options)
  );
  return Promise.race(promises);
}

/**
 * Execute a function with automatic retry logic and exponential backoff
 *
 * This is useful for operations that may fail temporarily (network requests,
 * database connections, etc.) and should be retried with increasing delays.
 * Supports true parallelism using worker threads.
 *
 * @param fn - Function to execute with retry logic
 * @param args - Arguments to pass to the function
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delay - Base delay between retries in milliseconds (default: 1000)
 * @param options - Goroutine options applied to each attempt
 * @returns Promise that resolves with the function result or rejects after all retries
 *
 * @example
 * ```typescript
 * const result = await goWithRetry(
 *   (url) => fetchUnreliableAPI(url),
 *   ['https://api.example.com/data'],
 *   5,  // max 5 retries
 *   1000 // start with 1 second delay
 * );
 * // Will retry with delays: 1s, 2s, 4s, 8s, 16s
 *
 * // With true parallelism
 * const result = await goWithRetry(
 *   (x, y) => heavyComputation(x, y),
 *   [10, 20],
 *   3,
 *   1000,
 *   { useWorkerThreads: true }
 * );
 * ```
 */
export async function goWithRetry<T>(
  fn: (...args: AnyValue[]) => T | Promise<T>,
  args: AnyValue[] = [],
  maxRetries: number = 3,
  delay: number = 1000,
  options: GoroutineOptions = {}
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await go(fn, args, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate exponential backoff delay: delay * 2^attempt
      const backoffDelay = delay * Math.pow(2, attempt);
      await sleep(backoffDelay);
    }
  }

  throw lastError!;
}

/**
 * Shutdown the global parallel scheduler
 */
export async function shutdownParallelScheduler(): Promise<void> {
  if (globalParallelScheduler) {
    await globalParallelScheduler.shutdown();
    globalParallelScheduler = null;
  }
}
