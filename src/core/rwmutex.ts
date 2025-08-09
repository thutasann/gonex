import {
  DEFAULT_RWMUTEX_TIMEOUT,
  INFINITE_TIMEOUT,
  MAX_READERS,
  RWMutexNotReadLockedError,
  RWMutexNotWriteLockedError,
  RWMutexReadLockTimeoutError,
  RWMutexTooManyReadersError,
  RWMutexWriteLockTimeoutError,
  validateTimeout,
} from '../utils';

/**
 * Options for configuring RWMutex behavior
 */
export type RWMutexOptions = {
  /** Timeout in milliseconds for lock acquisition (-1 for infinite) */
  timeout?: number;
  /** Optional name for debugging and error reporting */
  name?: string;
  /** Maximum number of concurrent readers (default: 1000000) */
  maxReaders?: number;
};

/** RWMutex Current State Information */
type RWMutexState = {
  readerCount: number;
  writerLocked: boolean;
  writerWaiting: boolean;
  pendingReaders: number;
  pendingWriters: number;
};

/**
 * High-performance read-write mutual exclusion lock
 *
 * Allows multiple concurrent readers OR one exclusive writer.
 * Follows Go's sync.RWMutex semantics:
 * - Multiple readers can hold the lock simultaneously
 * - Writers have exclusive access (no readers or other writers)
 * - Writer requests block new readers until writer releases
 * - Optimized for read-heavy workloads
 *
 * Performance optimizations:
 * - Fast path for uncontended read locks
 * - Efficient reader counting without locks
 * - Lock-free tryLock operations
 * - Minimal memory allocations
 */
export class RWMutex {
  private readerCount = 0;
  private writerLocked = false;
  private writerWaiting = false;

  // Read lock queue
  //   private readLockPromise: Promise<void> | null = null;
  //   private readLockResolve: (() => void) | null = null;
  private pendingReaders: (() => void)[] = [];

  // Write lock queue
  //   private writeLockPromise: Promise<void> | null = null;
  //   private writeLockResolve: (() => void) | null = null;
  private pendingWriters: (() => void)[] = [];

  private readonly timeout: number;
  private readonly name?: string;
  private readonly maxReaders: number;

  constructor(options: RWMutexOptions = {}) {
    const {
      timeout = DEFAULT_RWMUTEX_TIMEOUT,
      name,
      maxReaders = MAX_READERS,
    } = options;

    // Validate timeout if provided
    if (timeout !== undefined) {
      validateTimeout(timeout, name);
    }

    this.timeout = timeout;
    this.name = name || '';
    this.maxReaders = maxReaders;
  }

  /**
   * Acquire a read lock (shared, non-exclusive)
   *
   * Multiple readers can hold the lock simultaneously.
   * Blocks if a writer is currently holding or waiting for the lock.
   *
   * @param timeout - Optional timeout override in milliseconds
   * @returns Promise that resolves when read lock is acquired
   * @throws {RWMutexReadLockTimeoutError} When lock acquisition times out
   * @throws {RWMutexTooManyReadersError} When max readers limit exceeded
   */
  async rLock(timeout?: number): Promise<void> {
    const operationTimeout = timeout ?? this.timeout;

    if (this.readerCount >= this.maxReaders) {
      throw new RWMutexTooManyReadersError(this.maxReaders, this.name);
    }

    // Fast path: no writer active or waiting
    if (!this.writerLocked && !this.writerWaiting) {
      this.readerCount++;
      return;
    }

    // Slow path: wait for writer to finish
    return this.waitForReadLock(operationTimeout);
  }

  /**
   * Try to acquire a read lock without blocking
   *
   * @returns true if read lock was acquired, false otherwise
   * @throws {RWMutexTooManyReadersError} When max readers limit exceeded
   */
  tryRLock(): boolean {
    // Check max readers limit
    if (this.readerCount >= this.maxReaders) {
      throw new RWMutexTooManyReadersError(this.maxReaders, this.name);
    }

    // Can only acquire read lock if no writer is active or waiting
    if (this.writerLocked || this.writerWaiting) {
      return false;
    }

    this.readerCount++;
    return true;
  }

  /**
   * Release a read lock
   *
   * @throws {RWMutexNotReadLockedError} When no read lock is held
   */
  rUnlock(): void {
    if (this.readerCount <= 0) {
      throw new RWMutexNotReadLockedError(this.name);
    }

    this.readerCount--;

    // If this was the last reader and writers are waiting, wake them
    if (this.readerCount === 0 && this.pendingWriters.length > 0) {
      this.wakeNextWriter();
    }
  }

  /**
   * Acquire a write lock (exclusive)
   *
   * Only one writer can hold the lock, and no readers can be active.
   * Blocks until all current readers release their locks.
   *
   * @param timeout - Optional timeout override in milliseconds
   * @returns Promise that resolves when write lock is acquired
   * @throws {RWMutexWriteLockTimeoutError} When lock acquisition times out
   */
  async lock(timeout?: number): Promise<void> {
    const operationTimeout = timeout ?? this.timeout;

    // Fast path: no readers or writers
    if (this.readerCount === 0 && !this.writerLocked) {
      this.writerLocked = true;
      return;
    }

    // Slow path: wait for readers/writers to finish
    this.writerWaiting = true;
    return this.waitForWriteLock(operationTimeout);
  }

  /**
   * Try to acquire a write lock without blocking
   *
   * @returns true if write lock was acquired, false otherwise
   */
  tryLock(): boolean {
    // Can only acquire write lock if no readers or writers
    if (this.readerCount > 0 || this.writerLocked) {
      return false;
    }

    this.writerLocked = true;
    return true;
  }

  /**
   * Release a write lock
   *
   * @throws {RWMutexNotWriteLockedError} When no write lock is held
   */
  unlock(): void {
    if (!this.writerLocked) {
      throw new RWMutexNotWriteLockedError(this.name);
    }

    this.writerLocked = false;
    this.writerWaiting = false;

    // Wake pending readers first (readers have priority over new writers)
    if (this.pendingReaders.length > 0) {
      this.wakeAllReaders();
    } else if (this.pendingWriters.length > 0) {
      this.wakeNextWriter();
    }
  }

  /**
   * Get current state information
   *
   * @returns Object with current lock state
   */
  getState(): RWMutexState {
    return {
      readerCount: this.readerCount,
      writerLocked: this.writerLocked,
      writerWaiting: this.writerWaiting,
      pendingReaders: this.pendingReaders.length,
      pendingWriters: this.pendingWriters.length,
    };
  }

  /**
   * Check if any lock is currently held
   *
   * @returns true if any lock (read or write) is held
   */
  isLocked(): boolean {
    return this.readerCount > 0 || this.writerLocked;
  }

  /**
   * Check if a write lock is currently held
   *
   * @returns true if write lock is held
   */
  isWriteLocked(): boolean {
    return this.writerLocked;
  }

  /**
   * Check if any read locks are currently held
   *
   * @returns true if any read locks are held
   */
  isReadLocked(): boolean {
    return this.readerCount > 0;
  }

  /**
   * Wait for read lock acquisition
   */
  private async waitForReadLock(timeout: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.pendingReaders.push(() => {
        this.readerCount++;
        resolve();
      });

      // Set up timeout if specified
      if (timeout !== INFINITE_TIMEOUT) {
        setTimeout(() => {
          // Remove from pending readers
          const index = this.pendingReaders.findIndex(r => r === resolve);
          if (index >= 0) {
            this.pendingReaders.splice(index, 1);
          }
          reject(new RWMutexReadLockTimeoutError(timeout, this.name));
        }, timeout);
      }
    });
  }

  /**
   * Wait for write lock acquisition
   */
  private async waitForWriteLock(timeout: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.pendingWriters.push(() => {
        this.writerLocked = true;
        this.writerWaiting = false;
        resolve();
      });

      // Set up timeout if specified
      if (timeout !== INFINITE_TIMEOUT) {
        setTimeout(() => {
          // Remove from pending writers
          const index = this.pendingWriters.findIndex(w => w === resolve);
          if (index >= 0) {
            this.pendingWriters.splice(index, 1);
          }
          // If this was the last pending writer, clear waiting flag
          if (this.pendingWriters.length === 0) {
            this.writerWaiting = false;
          }
          reject(new RWMutexWriteLockTimeoutError(timeout, this.name));
        }, timeout);
      }
    });
  }

  /**
   * Wake all pending readers
   */
  private wakeAllReaders(): void {
    const readers = this.pendingReaders.splice(0);
    for (const reader of readers) {
      // Use setImmediate to avoid stack overflow with many readers
      setImmediate(reader);
    }
  }

  /**
   * Wake the next pending writer
   */
  private wakeNextWriter(): void {
    const writer = this.pendingWriters.shift();
    if (writer) {
      setImmediate(writer);
    }
  }
}

/**
 * Create a new RWMutex with the specified options
 *
 * Factory function for creating RWMutex instances
 *
 * @param options - RWMutex configuration options
 * @returns A new RWMutex instance
 *
 * @example
 * ```typescript
 * // Basic RWMutex
 * const rwmutex = rwMutex();
 *
 * // RWMutex with timeout
 * const rwmutex = rwMutex({ timeout: 5000 });
 *
 * // RWMutex with name for debugging
 * const rwmutex = rwMutex({ name: 'shared-cache' });
 *
 * // Read-heavy workload
 * await rwmutex.rLock();
 * try {
 *   // Multiple readers can access concurrently
 *   const data = await readSharedData();
 * } finally {
 *   rwmutex.rUnlock();
 * }
 *
 * // Exclusive write
 * await rwmutex.lock();
 * try {
 *   // Only one writer, no readers
 *   await writeSharedData(newData);
 * } finally {
 *   rwmutex.unlock();
 * }
 * ```
 */
export function rwMutex(options?: RWMutexOptions): RWMutex {
  return new RWMutex(options);
}
