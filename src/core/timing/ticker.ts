import { validateDuration } from '../../utils';
import { Channel } from '../channel';

/**
 * Options for configuring Ticker behavior
 */
export type TickerOptions = {
  /** Interval in milliseconds between tick events */
  interval: number;
  /** Optional name for debugging and error reporting */
  name?: string;
};

/**
 * High-performance periodic event ticker
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast start/stop operations
 * - Precise interval timing
 * - Efficient channel integration
 *
 * Similar to Go's time.Ticker but adapted for Node.js
 */
export class Ticker {
  private intervalId: NodeJS.Timeout | null = null;
  private channel: Channel<number> | null = null;
  private tickCount = 0;
  private isRunning = false;
  private readonly interval: number;
  private readonly name?: string;

  constructor(options: TickerOptions) {
    const { interval, name } = options;

    // Validate interval
    validateDuration(interval, name);

    this.interval = interval;
    this.name = name || 'Ticker';
  }

  /**
   * Start the ticker and return a channel for receiving tick events
   *
   * Fast path optimization for immediate start
   *
   * @returns Channel that receives tick count on each interval
   */
  start(): Channel<number> {
    // Fast path: already running
    if (this.isRunning) {
      return this.channel!;
    }

    // Create channel for tick events
    this.channel = new Channel<number>({
      bufferSize: 10,
      name: this.name ? `${this.name}-ticker` : 'ticker',
    });

    this.isRunning = true;
    this.tickCount = 0;

    // Start interval
    this.intervalId = setInterval(() => {
      if (!this.isRunning) {
        return;
      }

      this.tickCount++;

      // Send tick count to channel (non-blocking)
      this.channel!.trySend(this.tickCount);
    }, this.interval);

    return this.channel;
  }

  /**
   * Stop the ticker
   *
   * Fast path operation with immediate cleanup
   */
  stop(): void {
    if (!this.isRunning || !this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;

    // Close channel
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  /**
   * Check if the ticker is currently running
   *
   * @returns true if ticker is running, false otherwise
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the current interval in milliseconds
   *
   * @returns Current interval in milliseconds
   */
  getInterval(): number {
    return this.interval;
  }

  /**
   * Set a new interval for the ticker
   *
   * @param interval - New interval in milliseconds
   */
  setInterval(interval: number): void {
    validateDuration(interval, this.name);

    // Stop current ticker
    this.stop();

    // Update interval
    (this as AnyValue).interval = interval;

    // Restart if it was running
    if (this.isRunning) {
      this.start();
    }
  }

  /**
   * Get the current tick count
   *
   * @returns Number of ticks that have occurred
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Reset the tick count to zero
   */
  resetTickCount(): void {
    this.tickCount = 0;
  }
}

/**
 * Create a new Ticker with the specified options
 *
 * Factory function for creating Ticker instances
 *
 * @param options - Ticker configuration options
 * @returns A new Ticker instance
 *
 * @example
 * ```typescript
 * // Basic ticker
 * const ticker = new Ticker({ interval: 1000 });
 * const channel = ticker.start();
 *
 * go(async () => {
 *   for await (const tick of channel) {
 *     console.log('Tick:', tick);
 *   }
 * });
 *
 * // Ticker with dynamic interval
 * const ticker = new Ticker({ interval: 1000 });
 * const channel = ticker.start();
 *
 * setTimeout(() => ticker.setInterval(500), 5000); // Change to 500ms
 * setTimeout(() => ticker.stop(), 10000); // Stop after 10 seconds
 * ```
 */
export function ticker(options: TickerOptions): Ticker {
  return new Ticker(options);
}

/**
 * Create a ticker that sends events at regular intervals
 *
 * Convenience function for simple periodic events
 *
 * @param interval - Interval in milliseconds
 * @returns Channel that receives tick events
 *
 * @example
 * ```typescript
 * // Simple periodic events
 * const channel = createTicker(1000); // Every 1 second
 *
 * go(async () => {
 *   for await (const tick of channel) {
 *     console.log('Periodic event:', tick);
 *   }
 * });
 * ```
 */
export function createTicker(interval: number): Channel<number> {
  const ticker = new Ticker({ interval });
  return ticker.start();
}
