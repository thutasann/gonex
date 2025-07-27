import {
  ChannelClosedError,
  ChannelTimeoutError,
  CircularQueue,
  DEFAULT_CHANNEL_BUFFER,
  DEFAULT_CHANNEL_TIMEOUT,
  INFINITE_TIMEOUT,
  validateChannelOperation,
  validateChannelOptions,
} from '../utils';

/**
 * Options for configuring channel behavior
 */
export type ChannelOptions = {
  /** Buffer size for the channel (0 for unbuffered) */
  bufferSize?: number;
  /** Default timeout for send/receive operations in milliseconds */
  timeout?: number;
  /** Optional name for debugging and error reporting */
  name?: string;
};

/**
 * Represents a typed communication channel between goroutines
 *
 * Optimized for high performance with:
 * - Circular buffer for minimal memory allocations
 * - Efficient queue management
 * - Minimal object creation
 * - Fast path optimizations
 *
 * @template T - The type of values that can be sent through the channel
 */
class Channel<T> {
  private buffer: CircularQueue<T>;
  private sendQueue: Array<{
    value: T;
    resolve: () => void;
    reject: (err: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];
  private receiveQueue: Array<{
    resolve: (value: T | undefined) => void;
    reject: (error: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];
  private closed = false;
  private readonly bufferSize: number;
  private readonly defaultTimeout: number;
  private readonly name?: string;

  constructor(options: ChannelOptions = {}) {
    const {
      bufferSize = DEFAULT_CHANNEL_BUFFER,
      timeout = DEFAULT_CHANNEL_TIMEOUT,
      name,
    } = options;

    validateChannelOptions({
      bufferSize: bufferSize,
      name: name,
      timeout: timeout,
    } as ChannelOptions);

    this.bufferSize = bufferSize;
    this.defaultTimeout = timeout;
    this.name = name || '';
    this.buffer = new CircularQueue<T>(bufferSize);
  }

  /**
   * Send a value to the channel with optimized fast paths
   *
   * Fast paths for common scenarios:
   * - Immediate send to waiting receiver
   * - Immediate send to available buffer space
   * - Non-blocking when possible
   *
   * @param value - The value to send
   * @param timeout - Optional timeout override in milliseconds
   * @returns Promise that resolves when the value is sent
   */
  async send(value: T, timeout?: number): Promise<void> {
    validateChannelOperation('send');

    // Fast path: channel is closed
    if (this.closed) {
      throw new ChannelClosedError(this.name);
    }

    const operationTimeout = timeout ?? this.defaultTimeout;

    // Fast path: immediate send to waiting receiver
    if (this.receiveQueue.length > 0) {
      const receiver = this.receiveQueue.shift()!;
      if (receiver.timeoutId) {
        clearTimeout(receiver.timeoutId);
      }
      receiver.resolve(value);
      return;
    }

    // Fast path: immediate send to available buffer space
    if (this.buffer.push(value)) {
      return;
    }

    // Slow path: queue the send operation
    return new Promise<void>((resolve, reject) => {
      const sendOperation: AnyValue = {
        value,
        resolve,
        reject,
      };

      this.sendQueue.push(sendOperation);

      // Add timeout if specified
      if (operationTimeout !== INFINITE_TIMEOUT) {
        sendOperation.timeoutId = setTimeout(() => {
          const index = this.sendQueue.indexOf(sendOperation);
          if (index > -1) {
            this.sendQueue.splice(index, 1);
            reject(new ChannelTimeoutError(operationTimeout, this.name));
          }
        }, operationTimeout);
      }
    });
  }

  /**
   * Receive a value from the channel with optimized fast paths
   *
   * Fast paths for common scenarios:
   * - Immediate receive from buffer
   * - Immediate receive from waiting sender
   * - Non-blocking when possible
   *
   * @param timeout - Optional timeout override in milliseconds
   * @returns Promise that resolves with the received value or undefined if channel is closed
   */
  async receive(timeout?: number): Promise<T | undefined> {
    validateChannelOperation('receive');

    const operationTimeout = timeout ?? this.defaultTimeout;

    // Fast path: immediate receive from buffer
    const bufferedValue = this.buffer.shift();
    if (bufferedValue !== undefined) {
      this.processSendQueue();
      return bufferedValue;
    }

    // Fast path: channel is closed and empty
    if (this.closed) {
      return undefined;
    }

    // Slow path: queue the receive operation
    return new Promise<T | undefined>((resolve, reject) => {
      const receiveOperation: AnyValue = {
        resolve,
        reject,
      };

      this.receiveQueue.push(receiveOperation);

      // Add timeout if specified
      if (operationTimeout !== INFINITE_TIMEOUT) {
        receiveOperation.timeoutId = setTimeout(() => {
          const index = this.receiveQueue.indexOf(receiveOperation);
          if (index > -1) {
            this.receiveQueue.splice(index, 1);
            reject(new ChannelTimeoutError(operationTimeout, this.name));
          }
        }, operationTimeout);
      }
    });
  }

  /**
   * Try to send a value to the channel without blocking
   *
   * Optimized for maximum speed with minimal allocations
   *
   * @param value - The value to send
   * @returns true if the value was sent successfully, false otherwise
   */
  trySend(value: T): boolean {
    validateChannelOperation('send');

    // Fast path: channel is closed
    if (this.closed) {
      return false;
    }

    // Fast path: immediate send to waiting receiver
    if (this.receiveQueue.length > 0) {
      const receiver = this.receiveQueue.shift()!;
      if (receiver.timeoutId) {
        clearTimeout(receiver.timeoutId);
      }
      receiver.resolve(value);
      return true;
    }

    // Fast path: immediate send to available buffer space
    return this.buffer.push(value);
  }

  /**
   * Try to receive a value from the channel without blocking
   *
   * Optimized for maximum speed with minimal allocations
   *
   * @returns The received value, undefined if no value is available
   */
  tryReceive(): T | undefined {
    validateChannelOperation('receive');

    // Fast path: immediate receive from buffer
    const value = this.buffer.shift();
    if (value !== undefined) {
      this.processSendQueue();
      return value;
    }

    // Fast path: channel is closed and empty
    if (this.closed) {
      return undefined;
    }

    return undefined;
  }

  /**
   * Close the channel and cleanup resources
   *
   * Optimized cleanup with minimal operations
   */
  close(): void {
    if (this.closed) return;

    this.closed = true;

    // Fast cleanup of pending operations
    // Reject all pending send operations
    for (const sendOp of this.sendQueue) {
      if (sendOp.timeoutId) {
        clearTimeout(sendOp.timeoutId);
      }
      sendOp.reject(new ChannelClosedError(this.name));
    }
    this.sendQueue.length = 0; // Clear array efficiently

    // Resolve all pending receive operations with undefined
    for (const receiveOp of this.receiveQueue) {
      if (receiveOp.timeoutId) {
        clearTimeout(receiveOp.timeoutId);
      }
      receiveOp.resolve(undefined as AnyValue);
    }
    this.receiveQueue.length = 0; // Clear array efficiently

    // Clear buffer
    this.buffer.clear();
  }

  /**
   * Check if the channel is closed
   *
   * @returns true if the channel is closed, false otherwise
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get the current number of values in the buffer
   *
   * @returns Number of values currently buffered
   */
  length(): number {
    return this.buffer.length;
  }

  /**
   * Get the maximum capacity of the channel buffer
   *
   * @returns Maximum number of values that can be buffered
   */
  capacity(): number {
    return this.bufferSize;
  }

  /**
   * Process any waiting send operations that can now be completed
   *
   * Optimized to process multiple operations in a single pass
   */
  private processSendQueue() {
    // Process as many send operations as possible in one pass
    while (this.sendQueue.length > 0 && !this.buffer.isFull) {
      const sendOp = this.sendQueue.shift()!;

      // Clear timeout if it exists
      if (sendOp.timeoutId) {
        clearTimeout(sendOp.timeoutId);
      }

      // Add to buffer and resolve
      this.buffer.push(sendOp.value);
      sendOp.resolve();
    }
  }
}

/**
 * Create a new channel with the specified options
 *
 * Factory function optimized for common use cases
 *
 * @param options - Channel configuration options
 * @returns A new Channel instance
 *
 * @example
 * ```typescript
 * // Unbuffered channel (fastest for simple communication)
 * const ch = channel<string>();
 *
 * // Buffered channel (good for producer-consumer patterns)
 * const bufferedCh = channel<number>({ bufferSize: 10 });
 *
 * // Channel with custom timeout
 * const timeoutCh = channel<boolean>({
 *   bufferSize: 5,
 *   timeout: 2000
 * });
 * ```
 */
export function channel<T>(options?: ChannelOptions): Channel<T> {
  return new Channel<T>(options);
}
