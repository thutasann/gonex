import {
  createCancellablePromise,
  createTimeoutPromise,
  validateTimeout,
} from '../utils';
import { sleep } from './timing';

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
};

/**
 * Execute a function as a goroutine (lightweight concurrent function)
 *
 * This function provides Go-like goroutine semantics adapted for Node.js:
 * - Non-blocking execution using the event loop
 * - Proper error handling and propagation
 * - Support for timeouts and cancellation
 * - Resource cleanup and memory management
 *
 * @param fn - Function to execute asynchronously (can be sync or async)
 * @param options - Optional configuration for the goroutine
 * @returns Promise that resolves with the function result or rejects with an error
 *
 * @example
 * ```typescript
 * // Basic goroutine
 * const result = await go(() => "Hello from goroutine!");
 *
 * // Async goroutine with error handling
 * const result = await go(
 *   async () => {
 *     const data = await fetchData();
 *     return processData(data);
 *   },
 *   {
 *     onError: (error) => console.error("Goroutine failed:", error)
 *   }
 * );
 *
 * // Goroutine with timeout
 * const result = await go(
 *   async () => {
 *     await sleep(10000); // Long operation
 *     return "Done";
 *   },
 *   { timeout: 5000 }
 * );
 * ```
 */
export async function go<T>(
  fn: () => T | Promise<T>,
  options: GoroutineOptions = {}
): Promise<T> {
  const { name, timeout, onError, signal } = options;

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
      const result = fn();

      if (result instanceof Promise) {
        return await result;
      } else {
        return result;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (onError) {
        onError(err);
      }

      throw err;
    }
  };

  // Start with the main execution promise
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
    setImmediate(() => {
      promise.then(resolve).catch(reject);
    });
  });
}

/**
 * Execute multiple goroutines concurrently and wait for all to complete
 *
 * This is similar to Promise.all() but with goroutine semantics.
 * If any goroutine fails, the entire operation fails.
 *
 * @param fns - Array of functions to execute concurrently
 * @param options - Options applied to all goroutines
 * @returns Promise that resolves with array of results in the same order as input
 *
 * @example
 * ```typescript
 * const results = await goAll([
 *   () => fetchUser(1),
 *   () => fetchUser(2),
 *   () => fetchUser(3)
 * ]);
 * // results = [user1, user2, user3]
 * ```
 */
export async function goAll<T>(
  fns: Array<() => T | Promise<T>>,
  options: GoroutineOptions = {}
): Promise<T[]> {
  const promises = fns.map(fn => go(fn, options));
  return Promise.all(promises);
}

/**
 * Execute multiple goroutines concurrently and return the first result
 *
 * This is similar to Promise.race() but with goroutine semantics.
 * The first goroutine to complete (success or failure) determines the result.
 *
 * @param fns - Array of functions to execute concurrently
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
 * ```
 */
export async function goRace<T>(
  fns: Array<() => T | Promise<T>>,
  options: GoroutineOptions = {}
): Promise<T> {
  const promises = fns.map(fn => go(fn, options));
  return Promise.race(promises);
}

/**
 * Execute a function with automatic retry logic and exponential backoff
 *
 * This is useful for operations that may fail temporarily (network requests,
 * database connections, etc.) and should be retried with increasing delays.
 *
 * @param fn - Function to execute with retry logic
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delay - Base delay between retries in milliseconds (default: 1000)
 * @param options - Goroutine options applied to each attempt
 * @returns Promise that resolves with the function result or rejects after all retries
 *
 * @example
 * ```typescript
 * const result = await goWithRetry(
 *   () => fetchUnreliableAPI(),
 *   5,  // max 5 retries
 *   1000 // start with 1 second delay
 * );
 * // Will retry with delays: 1s, 2s, 4s, 8s, 16s
 * ```
 */
export async function goWithRetry<T>(
  fn: () => T | Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  options: GoroutineOptions = {}
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await go(fn, options);
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
