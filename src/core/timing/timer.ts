import { validateDuration } from '../../utils';

/**
 * Options for configuring Timer behavior
 */
export type TimerOptions = {
  /** Duration in milliseconds for the timer */
  duration: number;
  /** Optional name for debugging and error reporting */
  name?: string;
};

/**
 * High-performance one-time delayed event timer
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast start/stop operations
 * - Precise timing control
 * - Efficient timeout management
 *
 * Similar to Go's time.Timer but adapted for Node.js
 */
export class Timer {
  private timeoutId: NodeJS.Timeout | null = null;
  private startTime: number | null = null;
  private duration: number;
  private isRunning = false;
  private resolve: (() => void) | null = null;
  private reject: ((err: Error) => void) | null = null;
  private readonly name?: string;

  constructor(options: TimerOptions) {
    const { duration, name } = options;
    // Validate duration
    validateDuration(duration, name);

    this.duration = duration;
    this.name = name || 'Timer';
  }

  /**
   * Start the timer
   *
   * Fast path optimization for immediate start
   *
   * @returns Promise that resolves when timer completes
   */
  start(): Promise<void> {
    if (this.isRunning) {
      return new Promise<void>((resolve, reject) => {
        const originalResolve = this.resolve;
        const originalReject = this.reject;

        this.resolve = () => {
          if (originalResolve) {
            originalResolve();
          }
          resolve();
        };

        this.reject = (error: Error) => {
          if (originalReject) {
            originalReject(error);
          }
          reject(error);
        };
      });
    }

    // Reset state
    this.isRunning = true;
    this.startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      this.timeoutId = setTimeout(() => {
        this.isRunning = false;
        this.startTime = null;
        this.timeoutId = null;
        this.resolve?.();
        this.resolve = null;
        this.reject = null;
      }, this.duration);
    });
  }

  /**
   * Stop the timer before it completes
   *
   * Fast path operation with immediate cleanup
   */
  stop(): void {
    if (!this.isRunning || !this.timeoutId) {
      return;
    }

    // Clear timeout
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.isRunning = false;
    this.startTime = null;

    // Reject any waiting promises
    if (this.reject) {
      this.reject(new Error('Timer stopped'));
      this.resolve = null;
      this.reject = null;
    }
  }

  /**
   * Reset the timer with optional new duration
   *
   * Fast path operation with immediate restart
   *
   * @param duration - Optional new duration in milliseconds
   */
  reset(duration?: number): void {
    // Stop current timer
    this.stop();

    // Update duration if provided
    if (duration !== undefined) {
      validateDuration(duration, this.name);
      this.duration = duration;
    }

    // Restart timer
    this.start();
  }

  /**
   * Check if the timer is currently running
   *
   * @returns true if timer is running, false otherwise
   */
  isTimerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the remaining time in milliseconds
   *
   * @returns Remaining time in milliseconds, 0 if not running
   */
  remainingTime(): number {
    if (!this.isRunning || !this.startTime) {
      return 0;
    }

    const elapsed = Date.now() - this.startTime;
    const remaining = this.duration - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Get the original duration of the timer
   *
   * @returns Original duration in milliseconds
   */
  getDuration(): number {
    return this.duration;
  }

  /**
   * Set a new duration for the timer
   *
   * @param duration - New duration in milliseconds
   */
  setDuration(duration: number): void {
    validateDuration(duration, this.name);
    this.duration = duration;
  }
}

/**
 * Create a new Timer with the specified options
 *
 * Factory function for creating Timer instances
 *
 * @param options - Timer configuration options
 * @returns A new Timer instance
 *
 * @example
 * ```typescript
 * // Basic timer
 * const timer = new Timer({ duration: 5000 });
 * await timer.start(); // Waits 5 seconds
 *
 * // Timer with cancellation
 * const timer = new Timer({ duration: 10000 });
 * const promise = timer.start();
 * setTimeout(() => timer.stop(), 2000); // Cancel after 2 seconds
 *
 * // Timer with reset
 * const timer = new Timer({ duration: 5000 });
 * timer.start();
 * setTimeout(() => timer.reset(3000), 2000); // Reset to 3 seconds
 * ```
 */
export function timer(options: TimerOptions): Timer {
  return new Timer(options);
}

/**
 * Create a timer that resolves after the specified duration
 *
 * Convenience function for simple delayed execution
 *
 * @param duration - Duration in milliseconds
 * @returns Promise that resolves after the specified duration
 *
 * @example
 * ```typescript
 * // Simple delay
 * await delay(1000); // Wait 1 second
 *
 * // With timeout
 * await delay(5000); // Wait 5 seconds
 * ```
 */
export function delay(duration: number): Promise<void> {
  const timer = new Timer({ duration });
  return timer.start();
}
