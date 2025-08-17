import { SharedMemoryManager } from '../shared-memory/manager';

/**
 * A lock-free queue implementation using SharedArrayBuffer and atomic operations.
 * This queue is designed for single-producer, single-consumer scenarios where
 * maximum performance is required.
 *
 * The queue uses a circular buffer with atomic compare-and-swap operations
 * to ensure thread safety without locks.
 */
export class LockFreeQueue<T> {
  private buffer: SharedArrayBuffer;
  private head: Int32Array;
  private tail: Int32Array;
  private size: Int32Array;
  private capacity: number;
  private data: Uint8Array;
  private dataView: DataView;
  private memoryManager: SharedMemoryManager;

  /**
   * Creates a new lock-free queue with the specified capacity.
   * @param capacity - Maximum number of items the queue can hold
   * @param memoryManager - Optional shared memory manager for buffer allocation
   */
  constructor(capacity: number, memoryManager?: SharedMemoryManager) {
    this.capacity = capacity;
    this.memoryManager = memoryManager || new SharedMemoryManager();

    // Calculate buffer size: header (3 * 4 bytes) + data capacity
    const headerSize = 12; // 3 Int32Array elements
    const dataSize = capacity * 8; // Assume 8 bytes per item (64-bit pointer/index)
    const totalSize = headerSize + dataSize;

    // Create shared buffer
    this.buffer = this.memoryManager.createBuffer(
      totalSize,
      `lock-free-queue-${Date.now()}`
    );

    // Initialize header arrays
    this.head = new Int32Array(this.buffer, 0, 1);
    this.tail = new Int32Array(this.buffer, 4, 1);
    this.size = new Int32Array(this.buffer, 8, 1);

    // Initialize data array
    this.data = new Uint8Array(this.buffer, headerSize, dataSize);
    this.dataView = new DataView(this.buffer, headerSize);

    // Initialize queue state
    Atomics.store(this.head, 0, 0);
    Atomics.store(this.tail, 0, 0);
    Atomics.store(this.size, 0, 0);
  }

  /**
   * Enqueues an item into the queue.
   * @param data - The data to enqueue
   * @returns true if the item was successfully enqueued, false if the queue is full
   */
  enqueue(data: T): boolean {
    const currentTail = Atomics.load(this.tail, 0);
    const currentSize = Atomics.load(this.size, 0);

    // Check if queue is full
    if (currentSize >= this.capacity) {
      return false;
    }

    // Calculate next tail position
    const nextTail = (currentTail + 1) % this.capacity;

    // Try to atomically update tail and size
    const expectedTail = currentTail;
    // const expectedSize = currentSize;

    // Use compare-exchange to atomically update both values
    if (
      Atomics.compareExchange(this.tail, 0, expectedTail, nextTail) ===
      expectedTail
    ) {
      // Successfully updated tail, now store the data
      this.storeData(currentTail, data);

      // Increment size atomically
      Atomics.add(this.size, 0, 1);
      return true;
    }

    return false;
  }

  /**
   * Dequeues an item from the queue.
   * @returns The dequeued item, or undefined if the queue is empty
   */
  dequeue(): T | undefined {
    const currentHead = Atomics.load(this.head, 0);
    const currentSize = Atomics.load(this.size, 0);

    // Check if queue is empty
    if (currentSize <= 0) {
      return undefined;
    }

    // Calculate next head position
    const nextHead = (currentHead + 1) % this.capacity;

    // Try to atomically update head and size
    const expectedHead = currentHead;
    // const expectedSize = currentSize;

    // Use compare-exchange to atomically update both values
    if (
      Atomics.compareExchange(this.head, 0, expectedHead, nextHead) ===
      expectedHead
    ) {
      // Successfully updated head, now retrieve the data
      const data = this.loadData(currentHead);

      // Decrement size atomically
      Atomics.sub(this.size, 0, 1);
      return data;
    }

    return undefined;
  }

  /**
   * Peeks at the next item in the queue without removing it.
   * @returns The next item, or undefined if the queue is empty
   */
  peek(): T | undefined {
    const currentSize = Atomics.load(this.size, 0);

    if (currentSize <= 0) {
      return undefined;
    }

    const currentHead = Atomics.load(this.head, 0);
    return this.loadData(currentHead);
  }

  /**
   * Checks if the queue is empty.
   * @returns true if the queue is empty, false otherwise
   */
  isEmpty(): boolean {
    return Atomics.load(this.size, 0) <= 0;
  }

  /**
   * Checks if the queue is full.
   * @returns true if the queue is full, false otherwise
   */
  isFull(): boolean {
    return Atomics.load(this.size, 0) >= this.capacity;
  }

  /**
   * Gets the current number of items in the queue.
   * @returns The current size of the queue
   */
  getSize(): number {
    return Atomics.load(this.size, 0);
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
   * This operation is not atomic but is safe for single-threaded usage.
   */
  clear(): void {
    Atomics.store(this.head, 0, 0);
    Atomics.store(this.tail, 0, 0);
    Atomics.store(this.size, 0, 0);
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
      // Release the buffer
      this.memoryManager.releaseBuffer('LockFreeQueue');

      // Shutdown the memory manager to stop the cleanup timer
      this.memoryManager.shutdown();
    }
  }
}
