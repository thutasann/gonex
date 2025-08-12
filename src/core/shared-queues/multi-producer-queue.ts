/* eslint-disable no-constant-condition */
import { SharedMemoryManager } from '../shared-memory';

/**
 * A multi-producer queue implementation using SharedArrayBuffer and mutex-based locking.
 * This queue is designed for scenarios where multiple threads need to enqueue items
 * while maintaining thread safety and good performance.
 *
 * The queue uses a circular buffer with a mutex to ensure thread safety for
 * multiple producers and consumers.
 */
export class MultiProducerQueue<T> {
  private buffer: SharedArrayBuffer;
  private mutex: Int32Array;
  private condition: Int32Array;
  private head: Int32Array;
  private tail: Int32Array;
  private size: Int32Array;
  private capacity: number;
  private data: Uint8Array;
  private dataView: DataView;
  private memoryManager: SharedMemoryManager;

  /**
   * Creates a new multi-producer queue with the specified capacity.
   * @param capacity - Maximum number of items the queue can hold
   * @param memoryManager - Optional shared memory manager for buffer allocation
   */
  constructor(capacity: number, memoryManager?: SharedMemoryManager) {
    this.capacity = capacity;
    this.memoryManager = memoryManager || new SharedMemoryManager();

    // Calculate buffer size: header (4 * 4 bytes) + data capacity
    const headerSize = 16; // 4 Int32Array elements (mutex, condition, head, tail, size)
    const dataSize = capacity * 8; // Assume 8 bytes per item
    const totalSize = headerSize + dataSize;

    // Create shared buffer
    this.buffer = this.memoryManager.createBuffer(
      totalSize,
      `multi-producer-queue-${Date.now()}`
    );

    // Initialize header arrays
    this.mutex = new Int32Array(this.buffer, 0, 1);
    this.condition = new Int32Array(this.buffer, 4, 1);
    this.head = new Int32Array(this.buffer, 8, 1);
    this.tail = new Int32Array(this.buffer, 12, 1);
    this.size = new Int32Array(this.buffer, 8, 1);

    // Initialize data array
    this.data = new Uint8Array(this.buffer, headerSize, dataSize);
    this.dataView = new DataView(this.buffer, headerSize);

    // Initialize queue state
    Atomics.store(this.mutex, 0, 0); // 0 = unlocked, 1 = locked
    Atomics.store(this.condition, 0, 0);
    Atomics.store(this.head, 0, 0);
    Atomics.store(this.tail, 0, 0);
    Atomics.store(this.size, 0, 0);
  }

  /**
   * Acquires the mutex lock.
   * @returns true if the lock was acquired, false otherwise
   */
  private acquireLock(): boolean {
    const expected = 0; // Expected unlocked state
    const desired = 1; // Desired locked state

    return (
      Atomics.compareExchange(this.mutex, 0, expected, desired) === expected
    );
  }

  /**
   * Releases the mutex lock.
   */
  private releaseLock(): void {
    Atomics.store(this.mutex, 0, 0); // Set to unlocked
  }

  /**
   * Signals a condition to wake up waiting threads.
   * @param count - Number of threads to wake up (default: 1)
   */
  private signalCondition(count: number = 1): void {
    Atomics.notify(this.condition, 0, count);
  }

  /**
   * Waits for a condition to be signaled.
   * @param expectedValue - The expected value to wait for
   */
  waitForCondition(expectedValue: number): void {
    Atomics.wait(this.condition, 0, expectedValue);
  }

  /**
   * Enqueues an item into the queue.
   * @param data - The data to enqueue
   * @returns Promise that resolves when the item is enqueued
   */
  async enqueue(data: T): Promise<void> {
    while (true) {
      // Try to acquire the lock
      if (this.acquireLock()) {
        try {
          // Check if queue is full
          const currentSize = Atomics.load(this.size, 0);
          if (currentSize >= this.capacity) {
            // Queue is full, wait for space
            this.releaseLock();
            await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
            continue;
          }

          // Enqueue the item
          const currentTail = Atomics.load(this.tail, 0);
          this.storeData(currentTail, data);

          // Update tail and size
          const nextTail = (currentTail + 1) % this.capacity;
          Atomics.store(this.tail, 0, nextTail);
          Atomics.add(this.size, 0, 1);

          // Signal waiting consumers
          this.signalCondition();
          return;
        } finally {
          this.releaseLock();
        }
      } else {
        // Lock acquisition failed, try again
        await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
      }
    }
  }

  /**
   * Dequeues an item from the queue.
   * @returns Promise that resolves to the dequeued item
   */
  async dequeue(): Promise<T> {
    while (true) {
      // Try to acquire the lock
      if (this.acquireLock()) {
        try {
          // Check if queue is empty
          const currentSize = Atomics.load(this.size, 0);
          if (currentSize <= 0) {
            // Queue is empty, wait for data
            this.releaseLock();
            await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
            continue;
          }

          // Dequeue the item
          const currentHead = Atomics.load(this.head, 0);
          const data = this.loadData(currentHead);

          // Update head and size
          const nextHead = (currentHead + 1) % this.capacity;
          Atomics.store(this.head, 0, nextHead);
          Atomics.sub(this.size, 0, 1);

          // Signal waiting producers
          this.signalCondition();
          return data;
        } finally {
          this.releaseLock();
        }
      } else {
        // Lock acquisition failed, try again
        await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
      }
    }
  }

  /**
   * Attempts to enqueue an item without blocking.
   * @param data - The data to enqueue
   * @returns true if the item was successfully enqueued, false if the queue is full
   */
  tryEnqueue(data: T): boolean {
    if (this.acquireLock()) {
      try {
        const currentSize = Atomics.load(this.size, 0);
        if (currentSize >= this.capacity) {
          return false; // Queue is full
        }

        // Enqueue the item
        const currentTail = Atomics.load(this.tail, 0);
        this.storeData(currentTail, data);

        // Update tail and size
        const nextTail = (currentTail + 1) % this.capacity;
        Atomics.store(this.tail, 0, nextTail);
        Atomics.add(this.size, 0, 1);

        // Signal waiting consumers
        this.signalCondition();
        return true;
      } finally {
        this.releaseLock();
      }
    }
    return false; // Failed to acquire lock
  }

  /**
   * Attempts to dequeue an item without blocking.
   * @returns The dequeued item, or undefined if the queue is empty
   */
  tryDequeue(): T | undefined {
    if (this.acquireLock()) {
      try {
        const currentSize = Atomics.load(this.size, 0);
        if (currentSize <= 0) {
          return undefined; // Queue is empty
        }

        // Dequeue the item
        const currentHead = Atomics.load(this.head, 0);
        const data = this.loadData(currentHead);

        // Update head and size
        const nextHead = (currentHead + 1) % this.capacity;
        Atomics.store(this.head, 0, nextHead);
        Atomics.sub(this.size, 0, 1);

        // Signal waiting producers
        this.signalCondition();
        return data;
      } finally {
        this.releaseLock();
      }
    }
    return undefined; // Failed to acquire lock
  }

  /**
   * Checks if the queue is empty.
   * @returns true if the queue is empty, false otherwise
   */
  isEmpty(): boolean {
    if (this.acquireLock()) {
      try {
        return Atomics.load(this.size, 0) <= 0;
      } finally {
        this.releaseLock();
      }
    }
    return true; // Assume empty if we can't acquire lock
  }

  /**
   * Checks if the queue is full.
   * @returns true if the queue is full, false otherwise
   */
  isFull(): boolean {
    if (this.acquireLock()) {
      try {
        return Atomics.load(this.size, 0) >= this.capacity;
      } finally {
        this.releaseLock();
      }
    }
    return true; // Assume full if we can't acquire lock
  }

  /**
   * Gets the current number of items in the queue.
   * @returns The current size of the queue
   */
  getSize(): number {
    if (this.acquireLock()) {
      try {
        return Atomics.load(this.size, 0);
      } finally {
        this.releaseLock();
      }
    }
    return 0; // Return 0 if we can't acquire lock
  }

  /**
   * Gets the maximum capacity of the queue.
   * @returns The maximum capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Clears all items from the queue.
   * This operation requires the lock to be held.
   */
  clear(): void {
    if (this.acquireLock()) {
      try {
        Atomics.store(this.head, 0, 0);
        Atomics.store(this.tail, 0, 0);
        Atomics.store(this.size, 0, 0);
        // Signal all waiting threads
        this.signalCondition(Number.MAX_SAFE_INTEGER);
      } finally {
        this.releaseLock();
      }
    }
  }

  /**
   * Stores data at the specified position in the buffer.
   * @param position - The position to store the data
   * @param data - The data to store
   */
  private storeData(position: number, data: T): void {
    const offset = position * 8;

    if (typeof data === 'number') {
      this.dataView.setBigUint64(offset, BigInt(data), true);
    } else if (typeof data === 'string') {
      // Store string length and characters
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      this.dataView.setUint32(offset, bytes.length, true);
      bytes.forEach((byte, index) => {
        this.data[offset + 4 + index] = byte;
      });
    } else if (typeof data === 'boolean') {
      this.dataView.setUint8(offset, data ? 1 : 0);
    } else {
      // For objects, store a reference or serialize
      this.dataView.setBigUint64(
        offset,
        BigInt(JSON.stringify(data).length),
        true
      );
      const serialized = JSON.stringify(data);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(serialized);
      bytes.forEach((byte, index) => {
        this.data[offset + 8 + index] = byte;
      });
    }
  }

  /**
   * Loads data from the specified position in the buffer.
   * @param position - The position to load the data from
   * @returns The loaded data
   */
  private loadData(position: number): T {
    const offset = position * 8;

    // For simplicity, assume all data is numbers
    // In a real implementation, you'd need type information or metadata
    const value = this.dataView.getBigUint64(offset, true);
    return Number(value) as T;
  }

  /**
   * Gets the underlying SharedArrayBuffer for external access.
   * @returns The shared buffer
   */
  getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }

  /**
   * Releases the queue's resources.
   */
  destroy(): void {
    if (this.memoryManager) {
      // Note: In a real implementation, you'd need to track buffer names
      // this.memoryManager.releaseBuffer(bufferName);
    }
  }
}
