/* eslint-disable no-constant-condition */
import { SharedMemoryManager } from '../shared-memory/manager';

/**
 * Represents an item in the priority queue with priority and timestamp.
 */
export type PriorityItem<T> = {
  priority: number;
  data: T;
  timestamp: number;
};

/**
 * A priority queue implementation using SharedArrayBuffer and a binary heap.
 * This queue maintains items in priority order (highest priority first)
 * and uses mutex-based locking for thread safety.
 *
 * The queue uses a max-heap structure where the highest priority item
 * is always at the root (index 0).
 */
export class PriorityQueue<T> {
  private buffer: SharedArrayBuffer;
  private mutex: Int32Array;
  private condition: Int32Array;
  private heap: Int32Array;
  private size: Int32Array;
  private capacity: number;
  //   private data: Uint8Array;
  private dataView: DataView;
  private memoryManager: SharedMemoryManager;

  /**
   * Creates a new priority queue with the specified capacity.
   * @param capacity - Maximum number of items the queue can hold
   * @param memoryManager - Optional shared memory manager for buffer allocation
   */
  constructor(capacity: number, memoryManager?: SharedMemoryManager) {
    this.capacity = capacity;
    this.memoryManager = memoryManager || new SharedMemoryManager();

    // Calculate buffer size: header (3 * 4 bytes) + heap indices + data storage
    const headerSize = 12; // 3 Int32Array elements (mutex, condition, size)
    const heapSize = capacity * 4; // 4 bytes per heap index
    const dataSize = capacity * 16; // 16 bytes per item (priority + timestamp + data)
    const totalSize = headerSize + heapSize + dataSize;

    // Create shared buffer
    this.buffer = this.memoryManager.createBuffer(
      totalSize,
      `priority-queue-${Date.now()}`
    );

    // Initialize header arrays
    this.mutex = new Int32Array(this.buffer, 0, 1);
    this.condition = new Int32Array(this.buffer, 4, 1);
    this.size = new Int32Array(this.buffer, 8, 1);

    // Initialize heap array (stores indices into data array)
    this.heap = new Int32Array(this.buffer, headerSize, capacity);

    // Initialize data array
    // this.data = new Uint8Array(this.buffer, headerSize + heapSize, dataSize);
    this.dataView = new DataView(this.buffer, headerSize + heapSize);

    // Initialize queue state
    Atomics.store(this.mutex, 0, 0); // 0 = unlocked, 1 = locked
    Atomics.store(this.condition, 0, 0);
    Atomics.store(this.size, 0, 0);

    // Initialize heap array with -1 (invalid indices)
    for (let i = 0; i < capacity; i++) {
      this.heap[i] = -1;
    }
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
   * Gets the parent index of a given index.
   * @param index - The child index
   * @returns The parent index
   */
  private getParentIndex(index: number): number {
    return Math.floor((index - 1) / 2);
  }

  /**
   * Gets the left child index of a given index.
   * @param index - The parent index
   * @returns The left child index
   */
  private getLeftChildIndex(index: number): number {
    return 2 * index + 1;
  }

  /**
   * Gets the right child index of a given index.
   * @param index - The parent index
   * @returns The right child index
   */
  private getRightChildIndex(index: number): number {
    return 2 * index + 2;
  }

  /**
   * Swaps two items in the heap.
   * @param index1 - First index
   * @param index2 - Second index
   */
  private swapHeapItems(index1: number, index2: number): void {
    const temp = this.heap[index1];
    if (temp && this.heap[index1] && this.heap[index2]) {
      this.heap[index1] = this.heap[index2] || 0;
      this.heap[index2] = temp;
    }
  }

  /**
   * Compares two priority items.
   * @param index1 - First item index
   * @param index2 - Second item index
   * @returns true if first item has higher priority than second
   */
  private hasHigherPriority(index1: number, index2: number): boolean {
    if (index1 === -1 || index2 === -1) return false;

    const item1 = this.loadPriorityItem(this.heap[index1] || 0);
    const item2 = this.loadPriorityItem(this.heap[index2] || 0);

    if (item1.priority !== item2.priority) {
      return item1.priority > item2.priority; // Higher priority first
    }

    // If priorities are equal, earlier timestamp wins (FIFO)
    return item1.timestamp < item2.timestamp;
  }

  /**
   * Bubbles up an item to maintain heap property.
   * @param index - The index to bubble up
   */
  private bubbleUp(index: number): void {
    let currentIndex = index;

    while (currentIndex > 0) {
      const parentIndex = this.getParentIndex(currentIndex);

      if (this.hasHigherPriority(currentIndex, parentIndex)) {
        this.swapHeapItems(currentIndex, parentIndex);
        currentIndex = parentIndex;
      } else {
        break;
      }
    }
  }

  /**
   * Bubbles down an item to maintain heap property.
   * @param index - The index to bubble down
   */
  private bubbleDown(index: number): void {
    let currentIndex = index;

    while (true) {
      const leftChildIndex = this.getLeftChildIndex(currentIndex);
      const rightChildIndex = this.getRightChildIndex(currentIndex);

      let highestPriorityIndex = currentIndex;

      if (
        leftChildIndex < this.getSize() &&
        this.hasHigherPriority(leftChildIndex, highestPriorityIndex)
      ) {
        highestPriorityIndex = leftChildIndex;
      }

      if (
        rightChildIndex < this.getSize() &&
        this.hasHigherPriority(rightChildIndex, highestPriorityIndex)
      ) {
        highestPriorityIndex = rightChildIndex;
      }

      if (highestPriorityIndex === currentIndex) {
        break;
      }

      this.swapHeapItems(currentIndex, highestPriorityIndex);
      currentIndex = highestPriorityIndex;
    }
  }

  /**
   * Waits for a condition to be signaled.
   * @param expectedValue - The expected value to wait for
   */
  waitForCondition(expectedValue: number): void {
    Atomics.wait(this.condition, 0, expectedValue);
  }

  /**
   * Enqueues an item with the specified priority.
   * @param data - The data to enqueue
   * @param priority - The priority of the item (higher numbers = higher priority)
   * @returns Promise that resolves when the item is enqueued
   */
  async enqueue(data: T, priority: number): Promise<void> {
    while (true) {
      if (this.acquireLock()) {
        try {
          const currentSize = Atomics.load(this.size, 0);

          if (currentSize >= this.capacity) {
            // Queue is full, wait for space
            this.releaseLock();
            await new Promise(resolve => setTimeout(resolve, 1));
            continue;
          }

          // Create priority item
          const item: PriorityItem<T> = {
            priority,
            data,
            timestamp: Date.now(),
          };

          // Store the item in the data array
          const dataIndex = currentSize;
          this.storePriorityItem(dataIndex, item);

          // Add to heap
          this.heap[currentSize] = dataIndex;

          // Update size
          Atomics.add(this.size, 0, 1);

          // Bubble up to maintain heap property
          this.bubbleUp(currentSize);

          // Signal waiting consumers
          this.signalCondition();
          return;
        } finally {
          this.releaseLock();
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
  }

  /**
   * Dequeues the highest priority item from the queue.
   * @returns Promise that resolves to the dequeued item
   */
  async dequeue(): Promise<T> {
    while (true) {
      if (this.acquireLock()) {
        try {
          const currentSize = Atomics.load(this.size, 0);

          if (currentSize <= 0) {
            // Queue is empty, wait for data
            this.releaseLock();
            await new Promise(resolve => setTimeout(resolve, 1));
            continue;
          }

          // Get the highest priority item (root of heap)
          const dataIndex = this.heap[0] || 0;
          const item = this.loadPriorityItem(dataIndex);

          // Remove the root and replace with last item
          const lastDataIndex = this.heap[currentSize - 1];
          this.heap[0] = lastDataIndex || 0;
          this.heap[currentSize - 1] = -1; // Mark as invalid

          // Update size
          Atomics.sub(this.size, 0, 1);

          // Bubble down to maintain heap property
          if (this.getSize() > 0) {
            this.bubbleDown(0);
          }

          // Signal waiting producers
          this.signalCondition();
          return item.data;
        } finally {
          this.releaseLock();
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
  }

  /**
   * Peeks at the highest priority item without removing it.
   * @returns The highest priority item, or undefined if the queue is empty
   */
  peek(): T | undefined {
    if (this.acquireLock()) {
      try {
        const currentSize = Atomics.load(this.size, 0);

        if (currentSize <= 0) {
          return undefined;
        }

        const dataIndex = this.heap[0] || 0;
        const item = this.loadPriorityItem(dataIndex);
        return item.data;
      } finally {
        this.releaseLock();
      }
    }
    return undefined;
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
    return true;
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
    return true;
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
    return 0;
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
   */
  clear(): void {
    if (this.acquireLock()) {
      try {
        Atomics.store(this.size, 0, 0);

        // Reset heap array
        for (let i = 0; i < this.capacity; i++) {
          this.heap[i] = -1;
        }

        // Signal all waiting threads
        this.signalCondition(Number.MAX_SAFE_INTEGER);
      } finally {
        this.releaseLock();
      }
    }
  }

  /**
   * Stores a priority item at the specified position.
   * @param position - The position to store the item
   * @param item - The priority item to store
   */
  private storePriorityItem(position: number, item: PriorityItem<T>): void {
    const offset = position * 16; // 16 bytes per item

    // Store priority (4 bytes)
    this.dataView.setInt32(offset, item.priority, true);

    // Store timestamp (8 bytes)
    this.dataView.setBigUint64(offset + 4, BigInt(item.timestamp), true);

    // Store data (4 bytes - simplified, assumes data is small)
    if (typeof item.data === 'number') {
      this.dataView.setFloat64(offset + 12, item.data, true);
    } else {
      // For non-numbers, store a hash or reference
      const hash = this.hashCode(JSON.stringify(item.data));
      this.dataView.setInt32(offset + 12, hash, true);
    }
  }

  /**
   * Loads a priority item from the specified position.
   * @param position - The position to load the item from
   * @returns The loaded priority item
   */
  private loadPriorityItem(position: number): PriorityItem<T> {
    const offset = position * 16;

    const priority = this.dataView.getInt32(offset, true);
    const timestamp = Number(this.dataView.getBigUint64(offset + 4, true));

    // Simplified data loading - assumes all data is numbers
    const data = this.dataView.getFloat64(offset + 12, true) as T;

    return { priority, data, timestamp };
  }

  /**
   * Simple hash function for objects.
   * @param str - String to hash
   * @returns Hash value
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
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
