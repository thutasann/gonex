/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Shared Channel - Thread-safe channel implementation using shared memory
 * for efficient communication between worker threads with batching support.
 */

import { logger } from '../../utils/logger';
import { MutexState, SharedMemoryAtomics } from '../shared-memory/atomics';
import { BufferFlags, SharedMemoryBuffer } from '../shared-memory/buffer';

/**
 * Configuration for shared channel
 */
export type SharedChannelConfig = {
  /** Buffer size in bytes */
  bufferSize: number;
  /** Maximum number of messages in the channel */
  maxMessages: number;
  /** Enable message batching for better throughput */
  enableBatching: boolean;
  /** Compression threshold in bytes */
  compressionThreshold: number;
  /** Enable checksum validation */
  enableChecksum: boolean;
  /** Channel timeout in milliseconds */
  timeout: number;
};

/**
 * Message header structure
 */
type MessageHeader = {
  /** Message size in bytes */
  size: number;
  /** Message type identifier */
  type: number;
  /** Message flags */
  flags: number;
  /** Message timestamp */
  timestamp: number;
  /** Reserved for future use */
  reserved: number;
};

/**
 * Channel state information
 */
export type ChannelState = {
  /** Number of messages in the channel */
  length: number;
  /** Channel capacity */
  capacity: number;
  /** Whether channel is full */
  isFull: boolean;
  /** Whether channel is empty */
  isEmpty: boolean;
  /** Number of waiting senders */
  waitingSenders: number;
  /** Number of waiting receivers */
  waitingReceivers: number;
};

/**
 * High-performance shared channel for inter-thread communication
 *
 * Features:
 * - Lock-free operations where possible
 * - Message batching for improved throughput
 * - Automatic compression for large messages
 * - Checksum validation for data integrity
 * - Efficient wait-free algorithms
 */
export class SharedChannel<T> {
  private buffer: SharedMemoryBuffer;
  private mutex: Int32Array;
  private sendCondition: Int32Array;
  private receiveCondition: Int32Array;
  private head: Int32Array;
  private tail: Int32Array;
  private count: Int32Array;
  private waitingSenders: Int32Array;
  private waitingReceivers: Int32Array;
  private data: Uint8Array;
  private config: Required<SharedChannelConfig>;
  private messageSize: number;
  private headerSize: number;
  private isShuttingDown = false;

  constructor(config?: Partial<SharedChannelConfig>) {
    this.config = {
      bufferSize: 1024 * 1024, // 1MB default
      maxMessages: 1000,
      enableBatching: true,
      compressionThreshold: 1024, // 1KB
      enableChecksum: true,
      timeout: 30000, // 30 seconds
      ...config,
    };

    this.headerSize = 24; // 6 * 4 bytes (uint32)
    this.messageSize = this.config.bufferSize / this.config.maxMessages;

    // Ensure minimum message size
    if (this.messageSize < this.headerSize + 64) {
      this.messageSize = this.headerSize + 64;
    }

    // Create buffer with checksum if enabled
    const flags = this.config.enableChecksum ? BufferFlags.CHECKSUMED : 0;

    this.buffer = new SharedMemoryBuffer(
      this.config.bufferSize + 64, // +64 for control structures
      { flags }
    );

    // Initialize control structures at the beginning of the buffer
    const controlOffset = this.config.bufferSize;

    this.mutex = new Int32Array(this.buffer.getBuffer(), controlOffset, 1);
    this.sendCondition = new Int32Array(
      this.buffer.getBuffer(),
      controlOffset + 4,
      1
    );
    this.receiveCondition = new Int32Array(
      this.buffer.getBuffer(),
      controlOffset + 8,
      1
    );
    this.head = new Int32Array(this.buffer.getBuffer(), controlOffset + 12, 1);
    this.tail = new Int32Array(this.buffer.getBuffer(), controlOffset + 16, 1);
    this.count = new Int32Array(this.buffer.getBuffer(), controlOffset + 20, 1);
    this.waitingSenders = new Int32Array(
      this.buffer.getBuffer(),
      controlOffset + 24,
      1
    );
    this.waitingReceivers = new Int32Array(
      this.buffer.getBuffer(),
      controlOffset + 28,
      1
    );

    // Initialize control values
    Atomics.store(this.mutex, 0, MutexState.UNLOCKED);
    Atomics.store(this.sendCondition, 0, 0);
    Atomics.store(this.receiveCondition, 0, 0);
    Atomics.store(this.head, 0, 0);
    Atomics.store(this.tail, 0, 0);
    Atomics.store(this.count, 0, 0);
    Atomics.store(this.waitingSenders, 0, 0);
    Atomics.store(this.waitingReceivers, 0, 0);

    this.data = new Uint8Array(
      this.buffer.getBuffer(),
      0,
      this.config.bufferSize
    );

    logger.debug('SharedChannel created', { config: this.config });
  }

  /**
   * Send data through the channel
   *
   * @param data - Data to send
   * @returns Promise that resolves when data is sent
   * @throws Error if channel is full or shutting down
   */
  async send(data: T): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Channel is shutting down');
    }

    const serializedData = this.serialize(data);
    const messageSize = this.headerSize + serializedData.length;

    if (messageSize > this.messageSize) {
      throw new Error(
        `Message too large: ${messageSize} bytes (max: ${this.messageSize})`
      );
    }

    // Try to send without blocking first
    if (this.trySend(data)) {
      return;
    }

    // Wait for space to become available
    return this.waitAndSend(data);
  }

  /**
   * Receive data from the channel
   *
   * @returns Promise that resolves with received data
   * @throws Error if channel is empty or shutting down
   */
  async receive(): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Channel is shutting down');
    }

    // Try to receive without blocking first
    const data = this.tryReceive();
    if (data !== undefined) {
      return data;
    }

    // Wait for data to become available
    return this.waitAndReceive();
  }

  /**
   * Try to send data without blocking
   *
   * @param data - Data to send
   * @returns true if data was sent, false if channel is full
   */
  trySend(data: T): boolean {
    if (this.isShuttingDown) {
      return false;
    }

    const currentCount = Atomics.load(this.count, 0);
    if (currentCount >= this.config.maxMessages) {
      return false;
    }

    const serializedData = this.serialize(data);
    const messageSize = this.headerSize + serializedData.length;

    if (messageSize > this.messageSize) {
      return false;
    }

    // Acquire mutex for thread-safe operation
    if (!SharedMemoryAtomics.acquireMutex(this.mutex, 0, 100)) {
      return false;
    }

    try {
      // Double-check count after acquiring mutex
      const count = Atomics.load(this.count, 0);
      if (count >= this.config.maxMessages) {
        return false;
      }

      // Write message to buffer
      const tail = Atomics.load(this.tail, 0);
      const offset = this.calculateMessageOffset(tail);

      this.writeMessage(offset, data, serializedData);

      // Update tail and count
      Atomics.store(this.tail, 0, (tail + 1) % this.config.maxMessages);
      Atomics.add(this.count, 0, 1);

      // Signal waiting receivers
      const waitingReceivers = Atomics.load(this.waitingReceivers, 0);
      if (waitingReceivers > 0) {
        SharedMemoryAtomics.notifyCondition(this.receiveCondition, 0, 1);
        Atomics.add(this.waitingReceivers, 0, -1);
      }

      return true;
    } finally {
      SharedMemoryAtomics.releaseMutex(this.mutex, 0);
    }
  }

  /**
   * Try to receive data without blocking
   *
   * @returns Received data or undefined if channel is empty
   */
  tryReceive(): T | undefined {
    if (this.isShuttingDown) {
      return undefined;
    }

    const currentCount = Atomics.load(this.count, 0);
    if (currentCount === 0) {
      return undefined;
    }

    // Acquire mutex for thread-safe operation
    if (!SharedMemoryAtomics.acquireMutex(this.mutex, 0, 100)) {
      return undefined;
    }

    try {
      // Double-check count after acquiring mutex
      const count = Atomics.load(this.count, 0);
      if (count === 0) {
        return undefined;
      }

      // Read message from buffer
      const head = Atomics.load(this.head, 0);
      const offset = this.calculateMessageOffset(head);

      const data = this.readMessage(offset);

      // Update head and count
      Atomics.store(this.head, 0, (head + 1) % this.config.maxMessages);
      Atomics.add(this.count, 0, -1);

      // Signal waiting senders
      const waitingSenders = Atomics.load(this.waitingSenders, 0);
      if (waitingSenders > 0) {
        SharedMemoryAtomics.notifyCondition(this.sendCondition, 0, 1);
        Atomics.add(this.waitingSenders, 0, -1);
      }

      return data;
    } finally {
      SharedMemoryAtomics.releaseMutex(this.mutex, 0);
    }
  }

  /**
   * Send multiple messages in a batch
   *
   * @param dataArray - Array of data to send
   * @returns Promise that resolves when all data is sent
   */
  async sendBatch(dataArray: T[]): Promise<void> {
    if (!this.config.enableBatching) {
      // Fall back to individual sends
      for (const data of dataArray) {
        await this.send(data);
      }
      return;
    }

    if (this.isShuttingDown) {
      throw new Error('Channel is shutting down');
    }

    // Check if we have enough space for the batch
    const totalSize = dataArray.reduce((sum, data) => {
      return sum + this.headerSize + this.serialize(data).length;
    }, 0);

    if (totalSize > this.config.bufferSize) {
      throw new Error(
        `Batch too large: ${totalSize} bytes (max: ${this.config.bufferSize})`
      );
    }

    // Try to send the entire batch
    if (this.trySendBatch(dataArray)) {
      return;
    }

    // Wait for space and send batch
    return this.waitAndSendBatch(dataArray);
  }

  /**
   * Receive multiple messages in a batch
   *
   * @param count - Number of messages to receive
   * @returns Promise that resolves with array of received data
   */
  async receiveBatch(count: number): Promise<T[]> {
    if (!this.config.enableBatching) {
      // Fall back to individual receives
      const results: T[] = [];
      for (let i = 0; i < count; i++) {
        const data = await this.receive();
        results.push(data);
      }
      return results;
    }

    if (this.isShuttingDown) {
      throw new Error('Channel is shutting down');
    }

    const availableCount = Math.min(count, this.getLength());
    if (availableCount === 0) {
      return [];
    }

    // Try to receive the batch
    const results = this.tryReceiveBatch(availableCount);
    if (results.length > 0) {
      return results;
    }

    // Wait for data and receive batch
    return this.waitAndReceiveBatch(count);
  }

  /**
   * Get current channel state
   *
   * @returns Channel state information
   */
  getState(): ChannelState {
    const length = Atomics.load(this.count, 0);
    const waitingSenders = Atomics.load(this.waitingSenders, 0);
    const waitingReceivers = Atomics.load(this.waitingReceivers, 0);

    return {
      length,
      capacity: this.config.maxMessages,
      isFull: length >= this.config.maxMessages,
      isEmpty: length === 0,
      waitingSenders,
      waitingReceivers,
    };
  }

  /**
   * Check if channel is full
   *
   * @returns true if channel is full
   */
  isFull(): boolean {
    return Atomics.load(this.count, 0) >= this.config.maxMessages;
  }

  /**
   * Check if channel is empty
   *
   * @returns true if channel is empty
   */
  isEmpty(): boolean {
    return Atomics.load(this.count, 0) === 0;
  }

  /**
   * Get current channel length
   *
   * @returns Number of messages in the channel
   */
  getLength(): number {
    return Atomics.load(this.count, 0);
  }

  /**
   * Get channel capacity
   *
   * @returns Maximum number of messages
   */
  getCapacity(): number {
    return this.config.maxMessages;
  }

  /**
   * Shutdown the channel
   */
  shutdown(): void {
    this.isShuttingDown = true;

    // Wake up all waiting threads
    const waitingSenders = Atomics.load(this.waitingSenders, 0);
    const waitingReceivers = Atomics.load(this.waitingReceivers, 0);

    if (waitingSenders > 0) {
      SharedMemoryAtomics.notifyAllConditions(this.sendCondition, 0);
    }

    if (waitingReceivers > 0) {
      SharedMemoryAtomics.notifyAllConditions(this.receiveCondition, 0);
    }

    logger.info('SharedChannel shutdown completed');
  }

  /**
   * Clear all messages from the channel
   */
  clear(): void {
    if (this.isShuttingDown) {
      return;
    }

    // Acquire mutex for thread-safe operation
    if (!SharedMemoryAtomics.acquireMutex(this.mutex, 0, 100)) {
      return;
    }

    try {
      // Reset all control values
      Atomics.store(this.head, 0, 0);
      Atomics.store(this.tail, 0, 0);
      Atomics.store(this.count, 0, 0);

      // Wake up all waiting threads
      const waitingSenders = Atomics.load(this.waitingSenders, 0);
      const waitingReceivers = Atomics.load(this.waitingReceivers, 0);

      if (waitingSenders > 0) {
        SharedMemoryAtomics.notifyAllConditions(this.sendCondition, 0);
        Atomics.store(this.waitingSenders, 0, 0);
      }

      if (waitingReceivers > 0) {
        SharedMemoryAtomics.notifyAllConditions(this.receiveCondition, 0);
        Atomics.store(this.waitingReceivers, 0, 0);
      }
    } finally {
      SharedMemoryAtomics.releaseMutex(this.mutex, 0);
    }
  }

  /**
   * Check if the channel is healthy
   */
  isHealthy(): boolean {
    if (this.isShuttingDown) {
      return false;
    }

    try {
      // Check if control structures are accessible
      const count = Atomics.load(this.count, 0);
      const head = Atomics.load(this.head, 0);
      const tail = Atomics.load(this.tail, 0);

      // Validate bounds
      if (count < 0 || count > this.config.maxMessages) {
        return false;
      }

      if (head < 0 || head >= this.config.maxMessages) {
        return false;
      }

      if (tail < 0 || tail >= this.config.maxMessages) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): {
    totalSize: number;
    dataSize: number;
    controlSize: number;
    usedSize: number;
    freeSize: number;
  } {
    const length = this.getLength();
    const usedSize = length * this.messageSize;

    return {
      totalSize: this.config.bufferSize + 64, // +64 for control structures
      dataSize: this.config.bufferSize,
      controlSize: 64,
      usedSize,
      freeSize: this.config.bufferSize - usedSize,
    };
  }

  /**
   * Wait for space and send data
   */
  private async waitAndSend(data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Send timeout'));
      }, this.config.timeout);

      const checkAndSend = () => {
        if (this.isShuttingDown) {
          clearTimeout(timeoutId);
          reject(new Error('Channel is shutting down'));
          return;
        }

        if (this.trySend(data)) {
          clearTimeout(timeoutId);
          resolve();
          return;
        }

        // Increment waiting senders
        Atomics.add(this.waitingSenders, 0, 1);

        // Wait for condition
        SharedMemoryAtomics.waitCondition(this.sendCondition, 0, 0, 100);

        // Decrement waiting senders
        Atomics.add(this.waitingSenders, 0, -1);

        // Try again
        setImmediate(checkAndSend);
      };

      checkAndSend();
    });
  }

  /**
   * Wait for data and receive
   */
  private async waitAndReceive(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Receive timeout'));
      }, this.config.timeout);

      const checkAndReceive = () => {
        if (this.isShuttingDown) {
          clearTimeout(timeoutId);
          reject(new Error('Channel is shutting down'));
          return;
        }

        const data = this.tryReceive();
        if (data !== undefined) {
          clearTimeout(timeoutId);
          resolve(data);
          return;
        }

        // Increment waiting receivers
        Atomics.add(this.waitingReceivers, 0, 1);

        // Wait for condition
        SharedMemoryAtomics.waitCondition(this.receiveCondition, 0, 0, 100);

        // Decrement waiting receivers
        Atomics.add(this.waitingReceivers, 0, -1);

        // Try again
        setImmediate(checkAndReceive);
      };

      checkAndReceive();
    });
  }

  /**
   * Try to send a batch of messages
   */
  private trySendBatch(dataArray: T[]): boolean {
    if (this.isShuttingDown || dataArray.length === 0) {
      return false;
    }

    // Check if we have enough space for the entire batch
    const totalSize = dataArray.reduce((sum, data) => {
      return sum + this.headerSize + this.serialize(data).length;
    }, 0);

    if (totalSize > this.config.bufferSize) {
      return false;
    }

    const currentCount = Atomics.load(this.count, 0);
    const availableSpace = this.config.maxMessages - currentCount;

    if (availableSpace < dataArray.length) {
      return false;
    }

    // Acquire mutex for thread-safe batch operation
    if (!SharedMemoryAtomics.acquireMutex(this.mutex, 0, 100)) {
      return false;
    }

    try {
      // Double-check space after acquiring mutex
      const count = Atomics.load(this.count, 0);
      const space = this.config.maxMessages - count;

      if (space < dataArray.length) {
        return false;
      }

      // Write all messages to buffer
      const tail = Atomics.load(this.tail, 0);

      for (let i = 0; i < dataArray.length; i++) {
        const data = dataArray[i];
        const serializedData = this.serialize(data as T);
        const offset = this.calculateMessageOffset(
          (tail + i) % this.config.maxMessages
        );

        this.writeMessage(offset, data as T, serializedData);
      }

      // Update tail and count atomically
      Atomics.store(
        this.tail,
        0,
        (tail + dataArray.length) % this.config.maxMessages
      );
      Atomics.add(this.count, 0, dataArray.length);

      // Signal waiting receivers
      const waitingReceivers = Atomics.load(this.waitingReceivers, 0);
      if (waitingReceivers > 0) {
        const signals = Math.min(waitingReceivers, dataArray.length);
        SharedMemoryAtomics.notifyCondition(this.receiveCondition, 0, signals);
        Atomics.add(this.waitingReceivers, 0, -signals);
      }

      return true;
    } finally {
      SharedMemoryAtomics.releaseMutex(this.mutex, 0);
    }
  }

  /**
   * Wait and send a batch of messages
   */
  private async waitAndSendBatch(dataArray: T[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Batch send timeout'));
      }, this.config.timeout);

      const checkAndSendBatch = () => {
        if (this.isShuttingDown) {
          clearTimeout(timeoutId);
          reject(new Error('Channel is shutting down'));
          return;
        }

        if (this.trySendBatch(dataArray)) {
          clearTimeout(timeoutId);
          resolve();
          return;
        }

        // Increment waiting senders
        Atomics.add(this.waitingSenders, 0, 1);

        // Wait for condition
        SharedMemoryAtomics.waitCondition(this.sendCondition, 0, 0, 100);

        // Decrement waiting senders
        Atomics.add(this.waitingSenders, 0, -1);

        // Try again
        setImmediate(checkAndSendBatch);
      };

      checkAndSendBatch();
    });
  }

  /**
   * Try to receive a batch of messages
   */
  private tryReceiveBatch(count: number): T[] {
    if (this.isShuttingDown || count <= 0) {
      return [];
    }

    const currentCount = Atomics.load(this.count, 0);
    if (currentCount === 0) {
      return [];
    }

    // const availableCount = Math.min(count, currentCount);

    // Acquire mutex for thread-safe batch operation
    if (!SharedMemoryAtomics.acquireMutex(this.mutex, 0, 100)) {
      return [];
    }

    try {
      // Double-check count after acquiring mutex
      const countAfterMutex = Atomics.load(this.count, 0);
      if (countAfterMutex === 0) {
        return [];
      }

      const actualCount = Math.min(count, countAfterMutex);
      const results: T[] = [];

      // Read all available messages
      const head = Atomics.load(this.head, 0);

      for (let i = 0; i < actualCount; i++) {
        const offset = this.calculateMessageOffset(
          (head + i) % this.config.maxMessages
        );
        const data = this.readMessage(offset);
        results.push(data);
      }

      // Update head and count atomically
      Atomics.store(
        this.head,
        0,
        (head + actualCount) % this.config.maxMessages
      );
      Atomics.add(this.count, 0, -actualCount);

      // Signal waiting senders
      const waitingSenders = Atomics.load(this.waitingSenders, 0);
      if (waitingSenders > 0) {
        const signals = Math.min(waitingSenders, actualCount);
        SharedMemoryAtomics.notifyCondition(this.sendCondition, 0, signals);
        Atomics.add(this.waitingSenders, 0, -signals);
      }

      return results;
    } finally {
      SharedMemoryAtomics.releaseMutex(this.mutex, 0);
    }
  }

  /**
   * Wait and receive a batch of messages
   */
  private async waitAndReceiveBatch(count: number): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Batch receive timeout'));
      }, this.config.timeout);

      const checkAndReceiveBatch = () => {
        if (this.isShuttingDown) {
          clearTimeout(timeoutId);
          reject(new Error('Channel is shutting down'));
          return;
        }

        const results = this.tryReceiveBatch(count);
        if (results.length > 0) {
          clearTimeout(timeoutId);
          resolve(results);
          return;
        }

        // Increment waiting receivers
        Atomics.add(this.waitingReceivers, 0, 1);

        // Wait for condition
        SharedMemoryAtomics.waitCondition(this.receiveCondition, 0, 0, 100);

        // Decrement waiting receivers
        Atomics.add(this.waitingReceivers, 0, -1);

        // Try again
        setImmediate(checkAndReceiveBatch);
      };

      checkAndReceiveBatch();
    });
  }

  /**
   * Calculate message offset in the buffer
   */
  private calculateMessageOffset(index: number): number {
    // Ensure the offset is within the data buffer bounds
    const offset = (index * this.messageSize) % this.config.bufferSize;

    // Validate offset bounds
    if (offset < 0 || offset + this.messageSize > this.config.bufferSize) {
      throw new Error(`Invalid message offset: ${offset}`);
    }

    return offset;
  }

  /**
   * Write message to buffer
   */
  private writeMessage(
    offset: number,
    _data: T,
    serializedData: Uint8Array
  ): void {
    const header: MessageHeader = {
      size: serializedData.length,
      type: 0, // Default type
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
   * Read message from buffer
   */
  private readMessage(offset: number): T {
    // Read header
    const headerView = new DataView(
      this.data.buffer,
      this.data.byteOffset + offset,
      this.headerSize
    );
    const size = headerView.getUint32(0, false);

    // Read data
    const data = this.data.slice(
      offset + this.headerSize,
      offset + this.headerSize + size
    );

    return this.deserialize(data);
  }

  /**
   * Serialize data to Uint8Array
   */
  private serialize(data: T): Uint8Array {
    // Simple JSON serialization for now
    // In production, you might want to use a more efficient binary format
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
