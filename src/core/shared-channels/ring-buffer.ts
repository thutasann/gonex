/**
 * Ring Buffer Channel - High-performance lock-free ring buffer implementation
 * for single-producer-single-consumer scenarios with minimal contention.
 */

import { logger } from '../../utils/logger';
import { BufferFlags, SharedMemoryBuffer } from '../shared-memory/buffer';

/**
 * Ring buffer configuration
 */
export type RingBufferConfig = {
  /** Buffer capacity in bytes */
  capacity: number;
  /** Enable checksum validation */
  enableChecksum: boolean;
  /** Enable performance monitoring */
  enableMonitoring: boolean;
};

/**
 * Ring buffer statistics
 */
export type RingBufferStats = {
  /** Total bytes written */
  bytesWritten: number;
  /** Total bytes read */
  bytesRead: number;
  /** Number of write operations */
  writeCount: number;
  /** Number of read operations */
  readCount: number;
  /** Number of buffer overflows */
  overflows: number;
  /** Number of buffer underflows */
  underflows: number;
  /** Last write timestamp */
  lastWrite: number;
  /** Last read timestamp */
  lastRead: number;
};

/**
 * High-performance lock-free ring buffer channel
 *
 * Optimized for single-producer-single-consumer scenarios:
 * - Minimal contention with atomic operations
 * - Efficient memory layout for cache performance
 * - Automatic overflow/underflow handling
 * - Performance monitoring and statistics
 */
export class RingBufferChannel<T> {
  private buffer: SharedMemoryBuffer;
  private head: Int32Array;
  private tail: Int32Array;
  private size: Int32Array;
  private data: Uint8Array;
  private config: Required<RingBufferConfig>;
  private stats: RingBufferStats;
  private messageSize: number;
  private headerSize: number;
  private isShuttingDown = false;

  constructor(capacity: number, config?: Partial<RingBufferConfig>) {
    this.config = {
      capacity: Math.max(1024, capacity), // Minimum 1KB
      enableChecksum: true,
      enableMonitoring: true,
      ...config,
    };

    this.headerSize = 24; // 6 * 4 bytes (uint32)
    this.messageSize = 1024; // Default message size, will be adjusted

    this.stats = {
      bytesWritten: 0,
      bytesRead: 0,
      writeCount: 0,
      readCount: 0,
      overflows: 0,
      underflows: 0,
      lastWrite: 0,
      lastRead: 0,
    };

    const flags = this.config.enableChecksum ? BufferFlags.CHECKSUMED : 0;

    this.buffer = new SharedMemoryBuffer(
      this.config.capacity + 64, // +64 for control structures
      { flags },
      new SharedArrayBuffer(this.config.capacity + 64)
    );

    // Initialize control structures at the end of the buffer
    const controlOffset = this.config.capacity;

    this.head = new Int32Array(this.buffer.getBuffer(), controlOffset, 1);
    this.tail = new Int32Array(this.buffer.getBuffer(), controlOffset + 4, 1);
    this.size = new Int32Array(this.buffer.getBuffer(), controlOffset + 8, 1);

    // Initialize control values
    Atomics.store(this.head, 0, 0);
    Atomics.store(this.tail, 0, 0);
    Atomics.store(this.size, 0, 0);

    this.data = new Uint8Array(
      this.buffer.getBuffer(),
      0,
      this.config.capacity
    );

    logger.debug('RingBufferChannel created', {
      capacity,
      config: this.config,
    });
  }

  /**
   * Enqueue data into the ring buffer
   *
   * @param data - Data to enqueue
   * @returns true if data was enqueued, false if buffer is full
   */
  enqueue(data: T): boolean {
    if (this.isShuttingDown) {
      return false;
    }

    const serializedData = this.serialize(data);
    const messageSize = this.headerSize + serializedData.length;

    if (messageSize > this.messageSize) {
      // Adjust message size if needed
      this.messageSize = messageSize;
      this.resizeBuffer();
    }

    const currentSize = Atomics.load(this.size, 0);
    const availableSpace = this.config.capacity - currentSize;

    if (messageSize > availableSpace) {
      if (this.config.enableMonitoring) {
        this.stats.overflows++;
      }
      return false;
    }

    // Get current tail position
    const tail = Atomics.load(this.tail, 0);
    const offset = this.calculateOffset(tail);

    // Write message atomically
    this.writeMessage(offset, data, serializedData);

    // Update tail atomically
    Atomics.store(this.tail, 0, (tail + 1) % this.config.capacity);

    // Update size atomically
    Atomics.add(this.size, 0, messageSize);

    // Update statistics
    if (this.config.enableMonitoring) {
      this.stats.bytesWritten += messageSize;
      this.stats.writeCount++;
      this.stats.lastWrite = Date.now();
    }

    return true;
  }

  /**
   * Dequeue data from the ring buffer
   *
   * @returns Dequeued data or undefined if buffer is empty
   */
  dequeue(): T | undefined {
    if (this.isShuttingDown) {
      return undefined;
    }

    const currentSize = Atomics.load(this.size, 0);
    if (currentSize === 0) {
      if (this.config.enableMonitoring) {
        this.stats.underflows++;
      }
      return undefined;
    }

    // Get current head position
    const head = Atomics.load(this.head, 0);
    const offset = this.calculateOffset(head);

    // Read message header first to get size
    const header = this.readMessageHeader(offset);
    if (!header) {
      return undefined;
    }

    const messageSize = this.headerSize + header.size;

    // Check if we have enough data
    if (messageSize > currentSize) {
      if (this.config.enableMonitoring) {
        this.stats.underflows++;
      }
      return undefined;
    }

    // Read message data
    const data = this.readMessage(offset, header);

    // Update head atomically
    Atomics.store(this.head, 0, (head + 1) % this.config.capacity);

    // Update size atomically
    Atomics.add(this.size, 0, -messageSize);

    // Update statistics
    if (this.config.enableMonitoring) {
      this.stats.bytesRead += messageSize;
      this.stats.readCount++;
      this.stats.lastRead = Date.now();
    }

    return data;
  }

  /**
   * Peek at the next message without removing it
   *
   * @returns Next message or undefined if buffer is empty
   */
  peek(): T | undefined {
    if (this.isShuttingDown) {
      return undefined;
    }

    const currentSize = Atomics.load(this.size, 0);
    if (currentSize === 0) {
      return undefined;
    }

    const head = Atomics.load(this.head, 0);
    const offset = this.calculateOffset(head);

    const header = this.readMessageHeader(offset);
    if (!header) {
      return undefined;
    }

    const messageSize = this.headerSize + header.size;
    if (messageSize > currentSize) {
      return undefined;
    }

    return this.readMessage(offset, header);
  }

  /**
   * Check if buffer is full
   *
   * @returns true if buffer is full
   */
  isFull(): boolean {
    const currentSize = Atomics.load(this.size, 0);
    return currentSize >= this.config.capacity;
  }

  /**
   * Check if buffer is empty
   *
   * @returns true if buffer is empty
   */
  isEmpty(): boolean {
    return Atomics.load(this.size, 0) === 0;
  }

  /**
   * Get current buffer size
   *
   * @returns Number of bytes currently in the buffer
   */
  getSize(): number {
    return Atomics.load(this.size, 0);
  }

  /**
   * Get buffer capacity
   *
   * @returns Total buffer capacity in bytes
   */
  getCapacity(): number {
    return this.config.capacity;
  }

  /**
   * Get available space
   *
   * @returns Available space in bytes
   */
  getAvailableSpace(): number {
    const currentSize = Atomics.load(this.size, 0);
    return Math.max(0, this.config.capacity - currentSize);
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    if (this.isShuttingDown) {
      return;
    }

    // Reset all control values atomically
    Atomics.store(this.head, 0, 0);
    Atomics.store(this.tail, 0, 0);
    Atomics.store(this.size, 0, 0);

    // Clear the data area
    this.data.fill(0);

    // Reset statistics
    if (this.config.enableMonitoring) {
      this.stats = {
        bytesWritten: 0,
        bytesRead: 0,
        writeCount: 0,
        readCount: 0,
        overflows: 0,
        underflows: 0,
        lastWrite: 0,
        lastRead: 0,
      };
    }

    logger.debug('Ring buffer cleared');
  }

  /**
   * Get buffer statistics
   *
   * @returns Buffer usage statistics
   */
  getStats(): RingBufferStats {
    return { ...this.stats };
  }

  /**
   * Reset buffer statistics
   */
  resetStats(): void {
    if (this.config.enableMonitoring) {
      this.stats = {
        bytesWritten: 0,
        bytesRead: 0,
        writeCount: 0,
        readCount: 0,
        overflows: 0,
        underflows: 0,
        lastWrite: 0,
        lastRead: 0,
      };
    }
  }

  /**
   * Shutdown the ring buffer
   */
  shutdown(): void {
    this.isShuttingDown = true;
    logger.info('RingBufferChannel shutdown completed');
  }

  /**
   * Resize the buffer if needed
   */
  private resizeBuffer(): void {
    // This is a simplified resize implementation
    // In production, you might want to implement a more sophisticated resizing strategy
    logger.warn('Buffer resize requested', {
      newMessageSize: this.messageSize,
    });
  }

  /**
   * Calculate offset in the ring buffer
   */
  private calculateOffset(index: number): number {
    return (index * this.messageSize) % this.config.capacity;
  }

  /**
   * Write message to buffer
   */
  private writeMessage(
    offset: number,
    _data: T,
    serializedData: Uint8Array
  ): void {
    const header = {
      size: serializedData.length,
      type: 0,
      flags: 0,
      timestamp: Date.now(),
      reserved: 0,
    };

    // Write header
    const headerView = new DataView(
      this.data.buffer,
      this.data.byteOffset + offset,
      this.headerSize
    );
    headerView.setUint32(0, header.size, false);
    headerView.setUint32(4, header.type, false);
    headerView.setUint32(8, header.flags, false);
    headerView.setUint32(12, header.timestamp, false);
    headerView.setUint32(16, header.reserved, false);

    // Write data
    this.data.set(serializedData, offset + this.headerSize);
  }

  /**
   * Read message header from buffer
   */
  private readMessageHeader(offset: number): {
    size: number;
    type: number;
    flags: number;
    timestamp: number;
    reserved: number;
  } | null {
    try {
      const headerView = new DataView(
        this.data.buffer,
        this.data.byteOffset + offset,
        this.headerSize
      );

      return {
        size: headerView.getUint32(0, false),
        type: headerView.getUint32(4, false),
        flags: headerView.getUint32(8, false),
        timestamp: headerView.getUint32(12, false),
        reserved: headerView.getUint32(16, false),
      };
    } catch (error) {
      logger.error(
        'Failed to read message header',
        new Error('Failed to read message header'),
        { offset, error }
      );
      return null;
    }
  }

  /**
   * Read message from buffer
   */
  private readMessage(
    offset: number,
    header: {
      size: number;
      type: number;
      flags: number;
      timestamp: number;
      reserved: number;
    }
  ): T {
    const data = this.data.slice(
      offset + this.headerSize,
      offset + this.headerSize + header.size
    );
    return this.deserialize(data);
  }

  /**
   * Serialize data to Uint8Array
   */
  private serialize(data: T): Uint8Array {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }

  /**
   * Deserialize data from Uint8Array
   */
  private deserialize(data: Uint8Array): T {
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json);
  }
}
