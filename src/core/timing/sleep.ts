import { validateDuration } from '../../utils';

/**
 * High-performance cooperative yielding and delay implementation
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast sleep operations
 * - Precise timing control
 * - Event loop friendly
 *
 * Similar to Go's time.Sleep but adapted for Node.js event loop
 */

/**
 * Sleep for the specified duration with cooperative yielding
 *
 * This function provides precise timing while being friendly to the event loop.
 * It uses setTimeout for accurate delays and allows other goroutines to run.
 *
 * @param duration - Duration to sleep in milliseconds
 * @returns Promise that resolves after the specified duration
 *
 * @example
 * ```typescript
 * // Basic sleep
 * await sleep(1000); // Sleep for 1 second
 *
 * // Sleep with rate limiting
 * for (let i = 0; i < 10; i++) {
 *   await sleep(100); // Rate limit to 10 per second
 *   console.log('Operation:', i);
 * }
 * ```
 */
export function sleep(duration: number): Promise<void> {
  validateDuration(duration, 'sleep duration');

  return new Promise(resolve => {
    setTimeout(resolve, duration);
  });
}

/**
 * Sleep until a specific deadline
 *
 * This function calculates the remaining time until the deadline
 * and sleeps for that duration. If the deadline has already passed,
 * it resolves immediately.
 *
 * @param deadline - Date until which to sleep
 * @returns Promise that resolves when the deadline is reached
 *
 * @example
 * ```typescript
 * // Sleep until specific time
 * const deadline = new Date(Date.now() + 5000);
 * await sleepUntil(deadline); // Sleep until 5 seconds from now
 *
 * // Sleep until end of day
 * const endOfDay = new Date();
 * endOfDay.setHours(23, 59, 59, 999);
 * await sleepUntil(endOfDay);
 * ```
 */
export function sleepUntil(deadline: Date): Promise<void> {
  if (!(deadline instanceof Date) || isNaN(deadline.getTime())) {
    throw new Error('Invalid deadline: must be a valid Date');
  }

  const now = Date.now();
  const targetTime = deadline.getTime();
  const duration = targetTime - now;

  if (duration <= 0) {
    return Promise.resolve(); // Deadline has already passed
  }

  return sleep(duration);
}

/**
 * Sleep for a specified duration with high precision
 *
 * This function provides more precise timing for short durations
 * by using setImmediate for durations less than 1ms.
 *
 * @param duration - Duration to sleep in milliseconds
 * @returns Promise that resolves after the specified duration
 *
 * @example
 * ```typescript
 * // High precision sleep
 * await sleepFor(0.5); // Sleep for 0.5 milliseconds
 *
 * // Micro-batching with precise timing
 * for (let i = 0; i < 1000; i++) {
 *   await sleepFor(1); // 1ms precision
 *   processBatch();
 * }
 * ```
 */
export function sleepFor(duration: number): Promise<void> {
  validateDuration(duration, 'sleep duration');

  if (duration < 1) {
    // For very short durations, use setImmediate for better precision
    return new Promise(resolve => {
      setImmediate(resolve);
    });
  }

  return sleep(duration);
}

/**
 * Yield control to other goroutines
 *
 * This function allows other goroutines to run by yielding control
 * to the event loop. Useful for cooperative multitasking.
 *
 * @returns Promise that resolves on the next tick
 *
 * @example
 * ```typescript
 * // Cooperative yielding
 * for (let i = 0; i < 1000000; i++) {
 *   if (i % 1000 === 0) {
 *     await yield(); // Yield every 1000 iterations
 *   }
 *   processItem(i);
 * }
 * ```
 */
export function yieldFn(): Promise<void> {
  return new Promise(resolve => {
    setImmediate(resolve);
  });
}

/**
 * Wait for the next tick of the event loop
 *
 * This function waits for the next iteration of the event loop,
 * allowing other pending operations to complete.
 *
 * @returns Promise that resolves on the next tick
 *
 * @example
 * ```typescript
 * // Wait for next tick
 * await nextTick();
 * console.log('This runs after all current operations');
 * ```
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => {
    process.nextTick(resolve);
  });
}

/**
 * Sleep with exponential backoff
 *
 * This function implements exponential backoff for retry scenarios.
 * The delay increases exponentially with each attempt.
 *
 * @param attempt - Current attempt number (0-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @param factor - Backoff factor (default: 2)
 * @returns Promise that resolves after the calculated delay
 *
 * @example
 * ```typescript
 * // Exponential backoff for retries
 * for (let attempt = 0; attempt < 5; attempt++) {
 *   try {
 *     await riskyOperation();
 *     break;
 *   } catch (error) {
 *     await sleepWithBackoff(attempt, 1000, 30000);
 *   }
 * }
 * ```
 */
export function sleepWithBackoff(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  factor: number = 2
): Promise<void> {
  validateDuration(baseDelay, 'base delay');
  validateDuration(maxDelay, 'max delay');

  if (attempt < 0) {
    throw new Error('Attempt must be non-negative');
  }

  if (factor <= 0) {
    throw new Error('Factor must be positive');
  }

  const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
  return sleep(delay);
}

/**
 * Sleep with jitter for distributed systems
 *
 * This function adds random jitter to the sleep duration,
 * which is useful for preventing thundering herd problems
 * in distributed systems.
 *
 * @param duration - Base duration in milliseconds
 * @param jitterFactor - Jitter factor (0-1, default: 0.1)
 * @returns Promise that resolves after the jittered duration
 *
 * @example
 * ```typescript
 * // Sleep with jitter for distributed retries
 * await sleepWithJitter(1000, 0.1); // Sleep 900-1100ms
 *
 * // Exponential backoff with jitter
 * for (let attempt = 0; attempt < 3; attempt++) {
 *   await sleepWithJitter(1000 * Math.pow(2, attempt), 0.2);
 * }
 * ```
 */
export function sleepWithJitter(
  duration: number,
  jitterFactor: number = 0.1
): Promise<void> {
  validateDuration(duration, 'duration');

  if (jitterFactor < 0 || jitterFactor > 1) {
    throw new Error('Jitter factor must be between 0 and 1');
  }

  const jitter = duration * jitterFactor * (Math.random() * 2 - 1);
  const jitteredDuration = Math.max(0, duration + jitter);

  return sleep(jitteredDuration);
}
