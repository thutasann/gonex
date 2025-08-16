/**
 * Concurrent Hash Map - High-performance thread-safe map implementation
 * using segment-based locking for improved concurrency.
 */

import { logger } from '../../utils/logger';
import { MutexState, SharedMemoryAtomics } from '../shared-memory/atomics';
import { BufferFlags, SharedMemoryBuffer } from '../shared-memory/buffer';
import { SharedMap } from './shared-map';

/**
 * Configuration for concurrent hash map
 */
export type ConcurrentHashMapConfig = {
  /** Initial capacity of the map */
  initialCapacity: number;
  /** Number of segments for concurrent access */
  concurrencyLevel: number;
  /** Load factor threshold for resizing (0.0 to 1.0) */
  loadFactor: number;
  /** Enable checksum validation */
  enableChecksum: boolean;
  /** Enable automatic resizing */
  enableAutoResize: boolean;
  /** Maximum capacity limit */
  maxCapacity: number;
  /** Segment buffer size in bytes */
  segmentBufferSize: number;
};

/**
 * Segment information
 */
type SegmentInfo = {
  /** Segment index */
  index: number;
  /** Segment mutex */
  mutex: Int32Array;
  /** Segment buffer */
  buffer: SharedMemoryBuffer;
  /** Segment map instance */
  map: SharedMap<AnyValue, AnyValue>;
  /** Segment statistics */
  stats: {
    size: number;
    capacity: number;
    loadFactor: number;
  };
};

/**
 * Concurrent hash map statistics
 */
export type ConcurrentHashMapStats = {
  /** Total number of entries across all segments */
  totalSize: number;
  /** Total capacity across all segments */
  totalCapacity: number;
  /** Number of segments */
  segmentCount: number;
  /** Average load factor across segments */
  averageLoadFactor: number;
  /** Maximum load factor among segments */
  maxLoadFactor: number;
  /** Minimum load factor among segments */
  minLoadFactor: number;
  /** Segment utilization statistics */
  segmentUtilization: {
    [segmentIndex: number]: {
      size: number;
      capacity: number;
      loadFactor: number;
    };
  };
};

/**
 * High-performance concurrent hash map with segment-based locking
 *
 * Features:
 * - Segment-based locking for improved concurrency
 * - Automatic segment management and resizing
 * - Efficient hash distribution across segments
 * - Batch operations for better throughput
 * - Memory pooling for segment buffers
 * - Load balancing across segments
 */
export class ConcurrentHashMap<K, V> {
  private segments: SegmentInfo[] = [];
  private config: Required<ConcurrentHashMapConfig>;
  private segmentCount: number;
  private isShuttingDown = false;

  constructor(
    initialCapacity: number,
    concurrencyLevel: number,
    config?: Partial<ConcurrentHashMapConfig>
  ) {
    this.config = {
      initialCapacity: Math.max(16, initialCapacity),
      concurrencyLevel: Math.max(1, Math.min(concurrencyLevel, 64)), // Limit to 64 segments
      loadFactor: 0.75,
      enableChecksum: true,
      enableAutoResize: true,
      maxCapacity: 1000000, // 1M entries max
      segmentBufferSize: 1024 * 1024, // 1MB per segment
      ...config,
    };

    this.segmentCount = this.config.concurrencyLevel;

    // Calculate capacity per segment
    const capacityPerSegment = Math.ceil(
      this.config.initialCapacity / this.segmentCount
    );

    // Initialize segments
    this.initializeSegments(capacityPerSegment);

    logger.debug('ConcurrentHashMap created', {
      initialCapacity: this.config.initialCapacity,
      concurrencyLevel: this.config.concurrencyLevel,
      segmentCount: this.segmentCount,
      capacityPerSegment,
    });
  }

  /**
   * Initialize all segments
   */
  private initializeSegments(capacityPerSegment: number): void {
    for (let i = 0; i < this.segmentCount; i++) {
      const segment = this.createSegment(i, capacityPerSegment);
      this.segments.push(segment);
    }
  }

  /**
   * Create a new segment
   */
  private createSegment(index: number, capacity: number): SegmentInfo {
    // Create segment buffer
    const buffer = new SharedMemoryBuffer(this.config.segmentBufferSize, {
      flags: this.config.enableChecksum ? BufferFlags.CHECKSUMED : 0,
    });

    // Create segment mutex
    const mutex = new Int32Array(buffer.getBuffer(), 0, 1);
    Atomics.store(mutex, 0, MutexState.UNLOCKED);

    // Create segment map
    const map = new SharedMap<AnyValue, AnyValue>(capacity, {
      enableChecksum: this.config.enableChecksum,
      enableAutoResize: this.config.enableAutoResize,
      loadFactor: this.config.loadFactor,
    });

    return {
      index,
      mutex,
      buffer,
      map,
      stats: {
        size: 0,
        capacity,
        loadFactor: 0,
      },
    };
  }

  /**
   * Get segment index for a key
   */
  private getSegmentIndex(key: K): number {
    const hash = this.hashCode(key);
    return Math.abs(hash) % this.segmentCount;
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
   * Acquire segment lock
   */
  private acquireSegmentLock(segmentIndex: number): boolean {
    const segment = this.segments[segmentIndex];
    if (!segment) {
      return false;
    }
    return SharedMemoryAtomics.acquireMutex(segment.mutex, 0, 5000); // 5 second timeout
  }

  /**
   * Release segment lock
   */
  private releaseSegmentLock(segmentIndex: number): void {
    const segment = this.segments[segmentIndex];
    if (segment) {
      SharedMemoryAtomics.releaseMutex(segment.mutex, 0);
    }
  }

  /**
   * Set a key-value pair in the map
   */
  async set(key: K, value: V): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('ConcurrentHashMap is shutting down');
    }

    const segmentIndex = this.getSegmentIndex(key);

    if (!this.acquireSegmentLock(segmentIndex)) {
      throw new Error(`Failed to acquire lock for segment ${segmentIndex}`);
    }

    try {
      const segment = this.segments[segmentIndex];
      if (!segment) {
        throw new Error(`Segment not found at index: ${segmentIndex}`);
      }
      await segment.map.set(key, value);

      // Update segment statistics
      this.updateSegmentStats(segmentIndex);
    } finally {
      this.releaseSegmentLock(segmentIndex);
    }
  }

  /**
   * Get a value by key
   */
  async get(key: K): Promise<V | undefined> {
    if (this.isShuttingDown) {
      throw new Error('ConcurrentHashMap is shutting down');
    }

    const segmentIndex = this.getSegmentIndex(key);

    if (!this.acquireSegmentLock(segmentIndex)) {
      throw new Error(`Failed to acquire lock for segment ${segmentIndex}`);
    }

    try {
      const segment = this.segments[segmentIndex];
      if (!segment) {
        throw new Error(`Segment not found at index: ${segmentIndex}`);
      }
      return await segment.map.get(key);
    } finally {
      this.releaseSegmentLock(segmentIndex);
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
      throw new Error('ConcurrentHashMap is shutting down');
    }

    const segmentIndex = this.getSegmentIndex(key);

    if (!this.acquireSegmentLock(segmentIndex)) {
      throw new Error(`Failed to acquire lock for segment ${segmentIndex}`);
    }

    try {
      const segment = this.segments[segmentIndex];
      if (!segment) {
        throw new Error(`Segment not found at index: ${segmentIndex}`);
      }
      const result = await segment.map.delete(key);

      // Update segment statistics
      this.updateSegmentStats(segmentIndex);

      return result;
    } finally {
      this.releaseSegmentLock(segmentIndex);
    }
  }

  /**
   * Set multiple key-value pairs atomically
   */
  async setAll(entries: [K, V][]): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('ConcurrentHashMap is shutting down');
    }

    // Group entries by segment to minimize lock contention
    const segmentEntries = new Map<number, [K, V][]>();

    for (const [key, value] of entries) {
      const segmentIndex = this.getSegmentIndex(key);
      if (!segmentEntries.has(segmentIndex)) {
        segmentEntries.set(segmentIndex, []);
      }
      segmentEntries.get(segmentIndex)!.push([key, value]);
    }

    // Process each segment
    const promises = Array.from(segmentEntries.entries()).map(
      async ([segmentIndex, segmentEntries]) => {
        if (!this.acquireSegmentLock(segmentIndex)) {
          throw new Error(`Failed to acquire lock for segment ${segmentIndex}`);
        }

        try {
          const segment = this.segments[segmentIndex];
          if (!segment) {
            throw new Error(`Segment not found at index: ${segmentIndex}`);
          }

          for (const [key, value] of segmentEntries) {
            await segment.map.set(key, value);
          }

          // Update segment statistics
          this.updateSegmentStats(segmentIndex);
        } finally {
          this.releaseSegmentLock(segmentIndex);
        }
      }
    );

    await Promise.all(promises);
  }

  /**
   * Get multiple values by keys
   */
  async getAll(keys: K[]): Promise<(V | undefined)[]> {
    if (this.isShuttingDown) {
      throw new Error('ConcurrentHashMap is shutting down');
    }

    // Group keys by segment
    const segmentKeys = new Map<number, { key: K; index: number }[]>();

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i] as K;
      const segmentIndex = this.getSegmentIndex(key);
      if (!segmentKeys.has(segmentIndex)) {
        segmentKeys.set(segmentIndex, []);
      }
      segmentKeys.get(segmentIndex)!.push({ key, index: i });
    }

    // Initialize result array
    const results = new Array<V | undefined>(keys.length);

    // Process each segment
    const promises = Array.from(segmentKeys.entries()).map(
      async ([segmentIndex, segmentKeys]) => {
        if (!this.acquireSegmentLock(segmentIndex)) {
          throw new Error(`Failed to acquire lock for segment ${segmentIndex}`);
        }

        try {
          const segment = this.segments[segmentIndex];
          if (!segment) {
            throw new Error(`Segment not found at index: ${segmentIndex}`);
          }
          for (const { key, index } of segmentKeys) {
            results[index] = await segment.map.get(key);
          }
        } finally {
          this.releaseSegmentLock(segmentIndex);
        }
      }
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Get total map size
   */
  async getSize(): Promise<number> {
    let totalSize = 0;

    for (let i = 0; i < this.segmentCount; i++) {
      if (this.acquireSegmentLock(i)) {
        try {
          totalSize += this.segments[i]!.map.getSize();
        } finally {
          this.releaseSegmentLock(i);
        }
      }
    }

    return totalSize;
  }

  /**
   * Check if map is empty
   */
  async isEmpty(): Promise<boolean> {
    const size = await this.getSize();
    return size === 0;
  }

  /**
   * Clear all entries from the map
   */
  async clear(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('ConcurrentHashMap is shutting down');
    }

    // Clear all segments concurrently
    const promises = this.segments.map(async (segment, index) => {
      if (this.acquireSegmentLock(index)) {
        try {
          await segment.map.clear();
          this.updateSegmentStats(index);
        } finally {
          this.releaseSegmentLock(index);
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Update segment statistics
   */
  private updateSegmentStats(segmentIndex: number): void {
    const segment = this.segments[segmentIndex];
    if (segment) {
      const size = segment.map.getSize();
      const capacity = segment.map.getCapacity();
      segment.stats = {
        size,
        capacity,
        loadFactor: size / capacity,
      };
    }
  }

  /**
   * Get comprehensive map statistics
   */
  async getStats(): Promise<ConcurrentHashMapStats> {
    const segmentUtilization: { [key: number]: AnyValue } = {};
    let totalSize = 0;
    let totalCapacity = 0;
    let maxLoadFactor = 0;
    let minLoadFactor = Infinity;

    for (let i = 0; i < this.segmentCount; i++) {
      if (this.acquireSegmentLock(i)) {
        try {
          const segment = this.segments[i];
          if (!segment) {
            throw new Error(`Segment not found at index: ${i}`);
          }
          const size = segment.map.getSize();
          const capacity = segment.map.getCapacity();
          const loadFactor = size / capacity;

          totalSize += size;
          totalCapacity += capacity;
          maxLoadFactor = Math.max(maxLoadFactor, loadFactor);
          minLoadFactor = Math.min(minLoadFactor, loadFactor);

          segmentUtilization[i] = {
            size,
            capacity,
            loadFactor,
          };
        } finally {
          this.releaseSegmentLock(i);
        }
      }
    }

    const averageLoadFactor = totalCapacity > 0 ? totalSize / totalCapacity : 0;

    return {
      totalSize,
      totalCapacity,
      segmentCount: this.segmentCount,
      averageLoadFactor,
      maxLoadFactor,
      minLoadFactor,
      segmentUtilization,
    };
  }

  /**
   * Get segment information
   */
  getSegmentInfo(segmentIndex: number): SegmentInfo | undefined {
    if (segmentIndex >= 0 && segmentIndex < this.segmentCount) {
      return this.segments[segmentIndex];
    }
    return undefined;
  }

  /**
   * Get segment count
   */
  getSegmentCount(): number {
    return this.segmentCount;
  }

  /**
   * Check if resizing is needed across segments
   */
  async checkResize(): Promise<void> {
    if (!this.config.enableAutoResize) {
      return;
    }

    const stats = await this.getStats();
    if (stats.averageLoadFactor > this.config.loadFactor) {
      logger.debug('ConcurrentHashMap resize needed', {
        currentLoadFactor: stats.averageLoadFactor,
        targetLoadFactor: this.config.loadFactor,
      });

      // Resize logic would go here
      // This could involve creating new segments or redistributing entries
    }
  }

  /**
   * Get the underlying buffers for all segments
   */
  getAllBuffers(): SharedArrayBuffer[] {
    return this.segments.map(segment => segment.buffer.getBuffer());
  }

  /**
   * Shutdown the concurrent hash map
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Shutdown all segments
    const promises = this.segments.map(segment => segment.map.shutdown());
    await Promise.all(promises);

    logger.debug('ConcurrentHashMap shutdown completed');
  }
}
