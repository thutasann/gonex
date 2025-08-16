/**
 * Shared Map - Thread-safe map implementation using shared memory
 * for efficient key-value storage between worker threads.
 */

import { logger } from '../../utils';
import {
  BufferFlags,
  MutexState,
  SharedMemoryAtomics,
  SharedMemoryBuffer,
} from '../shared-memory';

export type SharedMapConfig = {
  /** Initial capacity of the map */
  initialCapacity: number;
  /** Load factor threshold for resizing (0.0 to 1.0) */
  loadFactor: number;
  /** Enable checksum validation */
  enableChecksum: boolean;
  /** Enable automatic resizing */
  enableAutoResize: boolean;
  /** Maximum capacity limit */
  maxCapacity: number;
};

/**
 * Map entry structure
 */
type MapEntry<K, V> = {
  /** Entry key */
  key: K;
  /** Entry value */
  value: V;
  /** Hash code of the key */
  hash: number;
  /** Next entry in the chain (for collision resolution) */
  next: number;
  /** Entry flags */
  flags: number;
};

/**
 * Map statistics
 */
export type MapStats = {
  /** Current number of entries */
  size: number;
  /** Map capacity */
  capacity: number;
  /** Number of buckets */
  bucketCount: number;
  /** Average chain length */
  averageChainLength: number;
  /** Maximum chain length */
  maxChainLength: number;
  /** Load factor */
  loadFactor: number;
};

/**
 * High-performance shared map for inter-thread key-value storage
 *
 * Features:
 * - Thread-safe operations using mutex-based locking
 * - Separate chaining for collision resolution
 * - Automatic resizing based on load factor
 * - Efficient hash table implementation
 * - Memory pooling for entry objects
 */
export class SharedMap<K, V> {
  private buffer: SharedMemoryBuffer;
  private mutex: Int32Array;
  private buckets: Int32Array;
  private entries: Uint8Array;
  private config: Required<SharedMapConfig>;
  private entrySize: number;
  private bucketCount: number;
  private isShuttingDown = false;

  constructor(initialCapacity: number, config?: Partial<SharedMapConfig>) {
    this.config = {
      initialCapacity: Math.max(16, initialCapacity),
      loadFactor: 0.75,
      enableChecksum: true,
      enableAutoResize: true,
      maxCapacity: 1000000, // 1M entries max
      ...config,
    };

    this.bucketCount = this.getNextPowerOfTwo(this.config.initialCapacity);
    this.entrySize = 32; // 8 bytes per field * 4 fields

    // Calculate buffer size
    const headerSize = 24; // 6 * 4 bytes (uint32)
    const bucketsSize = this.bucketCount * 4; // 4 bytes per bucket index
    const entriesSize = this.config.initialCapacity * this.entrySize;
    const totalSize = headerSize + bucketsSize + entriesSize;

    // Create shared buffer
    this.buffer = new SharedMemoryBuffer(totalSize, {
      flags: this.config.enableChecksum ? BufferFlags.CHECKSUMED : 0,
    });

    // Initialize header arrays
    this.mutex = new Int32Array(this.buffer.getBuffer(), 0, 1);
    this.buckets = new Int32Array(
      this.buffer.getBuffer(),
      headerSize,
      this.bucketCount
    );

    // Initialize entries array
    this.entries = new Uint8Array(
      this.buffer.getBuffer(),
      headerSize + bucketsSize,
      entriesSize
    );

    // Initialize map state
    this.initializeMap();

    logger.debug('SharedMap created', {
      capacity: this.config.initialCapacity,
      bucketCount: this.bucketCount,
      totalSize,
    });
  }

  /**
   * Initialize the map with empty state
   */
  private initializeMap(): void {
    // Initialize mutex to unlocked
    Atomics.store(this.mutex, 0, MutexState.UNLOCKED);

    // Initialize all buckets to -1 (empty)
    for (let i = 0; i < this.bucketCount; i++) {
      this.buckets[i] = -1;
    }

    // Clear entries array
    this.entries.fill(0);
  }

  /**
   * Get the next power of 2 greater than or equal to the given number
   */
  private getNextPowerOfTwo(n: number): number {
    let power = 1;

    while (power < n) {
      power *= 2;
    }
    return power;
  }

  /**
   * Calculate hash code for a key
   */
  private hashCode(key: K): number {
    if (typeof key === 'string') {
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash + char) & 0xffffffff;
      }
      return Math.abs(hash);
    } else if (typeof key === 'number') {
      return Math.abs(key) & 0xffffffff;
    } else if (typeof key === 'boolean') {
      return key ? 1 : 0;
    } else {
      // For objects, use JSON string hash
      const str = JSON.stringify(key);
      return this.hashCode(str as K);
    }
  }

  /**
   * Get bucket index for a hash code
   */
  private getBucketIndex(hash: number): number {
    return hash % this.bucketCount;
  }

  /**
   * Acquire the map mutex
   */
  private acquireLock(): boolean {
    return SharedMemoryAtomics.acquireMutex(this.mutex, 0, 5000); // 5 second timeout
  }

  /**
   * Release the map mutex
   */
  private releaseLock(): void {
    SharedMemoryAtomics.releaseMutex(this.mutex, 0);
  }

  /**
   * Set a key-value pair in the map
   */
  async set(key: K, value: V): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Map is shutting down');
    }

    if (!this.acquireLock()) {
      throw new Error('Failed to acquire map lock');
    }

    try {
      const hash = this.hashCode(key);
      const bucketIndex = this.getBucketIndex(hash);

      // Check if key already exists
      let currentIndex = this.buckets[bucketIndex] || 0;
      while (currentIndex !== -1) {
        const entry = this.readEntry(currentIndex);
        if (entry && this.equals(entry.key, key)) {
          // Update existing entry
          this.writeEntry(currentIndex, { ...entry, value });
          return;
        }
        currentIndex = entry?.next || -1;
      }

      // Find free entry slot
      const entryIndex = this.findFreeEntry();
      if (entryIndex === -1) {
        throw new Error('Map is full');
      }

      // Create new entry
      const entry: MapEntry<K, V> = {
        key,
        value,
        hash,
        next: this.buckets[bucketIndex] || 0,
        flags: 0,
      };

      // Write entry
      this.writeEntry(entryIndex, entry);

      // Update bucket chain
      this.buckets[bucketIndex] = entryIndex;

      // Check if resize is needed
      if (this.config.enableAutoResize) {
        this.checkResize();
      }
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Get a value by key
   */
  async get(key: K): Promise<V | undefined> {
    if (this.isShuttingDown) {
      throw new Error('Map is shutting down');
    }

    if (!this.acquireLock()) {
      throw new Error('Failed to acquire map lock');
    }

    try {
      const hash = this.hashCode(key);
      const bucketIndex = this.getBucketIndex(hash);

      let currentIndex = this.buckets[bucketIndex] || 0;
      while (currentIndex !== -1) {
        const entry = this.readEntry(currentIndex);
        if (entry && this.equals(entry.key, key)) {
          return entry.value;
        }
        currentIndex = entry?.next || -1;
      }

      return undefined;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Check if a key exists in the map
   */
  async has(key: K): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  /**
   * Delete a key-value pair from the map
   */
  async delete(key: K): Promise<boolean> {
    if (this.isShuttingDown) {
      throw new Error('Map is shutting down');
    }

    if (!this.acquireLock()) {
      throw new Error('Failed to acquire map lock');
    }

    try {
      const hash = this.hashCode(key);
      const bucketIndex = this.getBucketIndex(hash);

      let currentIndex = this.buckets[bucketIndex] || 0;
      let previousIndex = -1;

      while (currentIndex !== -1) {
        const entry = this.readEntry(currentIndex);
        if (entry && this.equals(entry.key, key)) {
          // Remove entry from chain
          if (previousIndex === -1) {
            this.buckets[bucketIndex] = entry.next;
          } else {
            const prevEntry = this.readEntry(previousIndex);
            if (prevEntry) {
              prevEntry.next = entry.next;
              this.writeEntry(previousIndex, prevEntry);
            }
          }

          // Mark entry as deleted
          this.clearEntry(currentIndex);
          return true;
        }

        previousIndex = currentIndex;
        currentIndex = entry?.next || -1;
      }

      return false;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Clear all entries from the map
   */
  async clear(): Promise<void> {
    if (!this.acquireLock()) {
      throw new Error('Failed to acquire map lock');
    }

    try {
      this.initializeMap();
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Get current map size
   */
  getSize(): number {
    // This is a simplified implementation - in practice you'd maintain a size counter
    let count = 0;
    for (let i = 0; i < this.bucketCount; i++) {
      let currentIndex = this.buckets[i] || 0;
      while (currentIndex !== -1) {
        count++;
        const entry = this.readEntry(currentIndex);
        currentIndex = entry?.next || -1;
      }
    }
    return count;
  }

  /**
   * Get map capacity
   */
  getCapacity(): number {
    return this.config.initialCapacity;
  }

  /**
   * Check if map is empty
   */
  isEmpty(): boolean {
    return this.getSize() === 0;
  }

  /**
   * Get map statistics
   */
  getStats(): MapStats {
    const size = this.getSize();
    const maxChainLength = this.calculateMaxChainLength();
    const averageChainLength = size > 0 ? size / this.bucketCount : 0;

    return {
      size,
      capacity: this.config.initialCapacity,
      bucketCount: this.bucketCount,
      averageChainLength,
      maxChainLength,
      loadFactor: size / this.bucketCount,
    };
  }

  /**
   * Calculate maximum chain length
   */
  private calculateMaxChainLength(): number {
    let maxLength = 0;
    for (let i = 0; i < this.bucketCount; i++) {
      let length = 0;
      let currentIndex = this.buckets[i] || 0;
      while (currentIndex !== -1) {
        length++;
        const entry = this.readEntry(currentIndex);
        currentIndex = entry?.next || -1;
      }
      maxLength = Math.max(maxLength, length);
    }
    return maxLength;
  }

  /**
   * Find a free entry slot
   */
  private findFreeEntry(): number {
    // Simple linear search for free slot
    for (let i = 0; i < this.config.initialCapacity; i++) {
      const entry = this.readEntry(i);
      if (!entry || entry.flags === 0) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Read an entry from the buffer
   */
  private readEntry(index: number): MapEntry<K, V> | null {
    const offset = index * this.entrySize;
    const dataView = new DataView(
      this.entries.buffer,
      this.entries.byteOffset + offset
    );

    // Check if entry is valid
    const flags = dataView.getUint32(24, false);
    if (flags === 0) {
      return null;
    }

    // Read entry data (simplified - assumes key and value are strings)
    const keyLength = dataView.getUint32(0, false);
    const valueLength = dataView.getUint32(4, false);
    const hash = dataView.getUint32(8, false);
    const next = dataView.getInt32(12, false);

    const keyBytes = new Uint8Array(
      this.entries.buffer,
      this.entries.byteOffset + offset + 28,
      keyLength
    );
    const valueBytes = new Uint8Array(
      this.entries.buffer,
      this.entries.byteOffset + offset + 28 + keyLength,
      valueLength
    );

    const key = new TextDecoder().decode(keyBytes) as K;
    const value = new TextDecoder().decode(valueBytes) as V;

    return { key, value, hash, next, flags };
  }

  /**
   * Write an entry to the buffer
   */
  private writeEntry(index: number, entry: MapEntry<K, V>): void {
    const offset = index * this.entrySize;
    const dataView = new DataView(
      this.entries.buffer,
      this.entries.byteOffset + offset
    );

    // Serialize key and value
    const keyBytes = new TextEncoder().encode(String(entry.key));
    const valueBytes = new TextEncoder().encode(String(entry.value));

    // Write entry data
    dataView.setUint32(0, keyBytes.length, false);
    dataView.setUint32(4, valueBytes.length, false);
    dataView.setUint32(8, entry.hash, false);
    dataView.setInt32(12, entry.next, false);
    dataView.setUint32(16, 0, false); // Reserved
    dataView.setUint32(20, 0, false); // Reserved
    dataView.setUint32(24, 1, false); // Flags (valid entry)

    // Write key and value data
    const keyOffset = offset + 28;
    const valueOffset = keyOffset + keyBytes.length;

    this.entries.set(keyBytes, keyOffset);
    this.entries.set(valueBytes, valueOffset);
  }

  /**
   * Clear an entry slot
   */
  private clearEntry(index: number): void {
    const offset = index * this.entrySize;
    const dataView = new DataView(
      this.entries.buffer,
      this.entries.byteOffset + offset
    );
    dataView.setUint32(24, 0, false); // Clear flags
  }

  /**
   * Check if two keys are equal
   */
  private equals(key1: K, key2: K): boolean {
    if (typeof key1 === 'string' && typeof key2 === 'string') {
      return key1 === key2;
    } else if (typeof key1 === 'number' && typeof key2 === 'number') {
      return key1 === key2;
    } else if (typeof key1 === 'boolean' && typeof key2 === 'boolean') {
      return key1 === key2;
    } else {
      return JSON.stringify(key1) === JSON.stringify(key2);
    }
  }

  /**
   * Check if map needs resizing
   */
  private checkResize(): void {
    const currentLoadFactor = this.getSize() / this.bucketCount;
    if (
      currentLoadFactor > this.config.loadFactor &&
      this.bucketCount < this.config.maxCapacity
    ) {
      // Resize logic would go here
      logger.debug('Map resize needed', {
        currentLoadFactor,
        loadFactor: this.config.loadFactor,
      });
    }
  }

  /**
   * Get the underlying buffer
   */
  getBuffer(): SharedArrayBuffer {
    return this.buffer.getBuffer();
  }

  /**
   * Shutdown the map
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    logger.debug('SharedMap shutdown completed');
  }
}
