/* eslint-disable no-constant-condition */
/**
 * Shared Memory Atomics - Thread-safe atomic operations for shared memory
 * synchronization, including mutexes, condition variables, and barriers.
 */

/**
 * Typed array types that support atomic operations
 */
export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array;

/**
 * Mutex state constants
 */
export const enum MutexState {
  UNLOCKED = 0,
  LOCKED = 1,
}

/**
 * Condition variable states
 */
export const enum ConditionState {
  WAITING = 0,
  SIGNALED = 1,
}

/**
 * Barrier states
 */
export const enum BarrierState {
  WAITING = 0,
  RELEASED = 1,
}

/**
 * High-performance atomic operations for shared memory
 *
 * Provides thread-safe synchronization primitives:
 * - Mutex operations with timeout support
 * - Condition variable signaling
 * - Barrier synchronization
 * - Memory ordering guarantees
 */
export abstract class SharedMemoryAtomics {
  /**
   * Acquire a mutex with optional timeout
   *
   * @param mutex - Int32Array containing mutex state
   * @param index - Index in the array
   * @param timeout - Optional timeout in milliseconds
   * @returns true if mutex was acquired, false if timeout
   */
  static acquireMutex(
    mutex: Int32Array,
    index: number,
    timeout?: number
  ): boolean {
    const startTime = Date.now();
    const timeoutMs = timeout || 0;

    while (true) {
      // Try to acquire the mutex
      const oldValue = Atomics.compareExchange(
        mutex,
        index,
        MutexState.UNLOCKED,
        MutexState.LOCKED
      );

      if (oldValue === MutexState.UNLOCKED) {
        // Successfully acquired the mutex
        // Atomics.fence(); // Ensure memory ordering Property 'fence' does not exist on type 'Atomics'.ts(2339)
        return true;
      }

      // Check timeout
      if (timeoutMs > 0 && Date.now() - startTime >= timeoutMs) {
        return false;
      }

      // Wait a bit before retrying (exponential backoff)
      Atomics.wait(mutex, index, oldValue, 1);
    }
  }

  /**
   * Release a mutex
   *
   * @param mutex - Int32Array containing mutex state
   * @param index - Index in the array
   */
  static releaseMutex(mutex: Int32Array, index: number): void {
    // Atomics.fence(); // Ensure all previous operations complete
    Atomics.store(mutex, index, MutexState.UNLOCKED);
    Atomics.notify(mutex, index, 1); // Wake up one waiting thread
  }

  /**
   * Try to acquire a mutex without blocking
   *
   * @param mutex - Int32Array containing mutex state
   * @param index - Index in the array
   * @returns true if mutex was acquired, false if already locked
   */
  static tryAcquireMutex(mutex: Int32Array, index: number): boolean {
    const oldValue = Atomics.compareExchange(
      mutex,
      index,
      MutexState.UNLOCKED,
      MutexState.LOCKED
    );

    if (oldValue === MutexState.UNLOCKED) {
      //   Atomics.fence();
      return true;
    }

    return false;
  }

  /**
   * Wait for a condition variable
   *
   * @param condition - Int32Array containing condition state
   * @param index - Index in the array
   * @param expected - Expected value to wait for
   * @param timeout - Optional timeout in milliseconds
   * @returns true if condition was signaled, false if timeout
   */
  static waitCondition(
    condition: Int32Array,
    index: number,
    expected: number,
    timeout?: number
  ): boolean {
    const timeoutMs = timeout || 0;

    if (timeoutMs === 0) {
      // Wait indefinitely
      Atomics.wait(condition, index, expected);
      return true;
    } else {
      // Wait with timeout
      const result = Atomics.wait(condition, index, expected, timeoutMs);
      return result === 'ok';
    }
  }

  /**
   * Notify a condition variable
   *
   * @param condition - Int32Array containing condition state
   * @param index - Index in the array
   * @param count - Number of threads to wake up (default: 1)
   */
  static notifyCondition(
    condition: Int32Array,
    index: number,
    count: number = 1
  ): void {
    // Atomics.fence();
    Atomics.store(condition, index, ConditionState.SIGNALED);
    Atomics.notify(condition, index, count);
  }

  /**
   * Notify all waiting threads on a condition variable
   *
   * @param condition - Int32Array containing condition state
   * @param index - Index in the array
   */
  static notifyAllConditions(condition: Int32Array, index: number): void {
    // Atomics.fence();
    Atomics.store(condition, index, ConditionState.SIGNALED);
    Atomics.notify(condition, index, Number.MAX_SAFE_INTEGER);
  }

  /**
   * Arrive at a barrier
   *
   * @param barrier - Int32Array containing barrier state
   * @param index - Index in the array
   * @param total - Total number of threads expected
   * @returns true if this thread should release others, false if should wait
   */
  static barrier(arrive: Int32Array, index: number, total: number): boolean {
    const current = Atomics.add(arrive, index, 1) + 1;

    if (current === total) {
      // Last thread to arrive, release the barrier
      Atomics.store(arrive, index, 0);
      Atomics.notify(arrive, index, total - 1);
      return true;
    }

    return false;
  }

  /**
   * Wait at a barrier
   *
   * @param barrier - Int32Array containing barrier state
   * @param index - Index in the array
   */
  static waitBarrier(barrier: Int32Array, index: number): void {
    Atomics.wait(barrier, index, 0);
  }

  /**
   * Atomic load with memory ordering
   *
   * @param array - Typed array to load from
   * @param index - Index in the array
   * @returns Loaded value
   */
  static load<T>(array: TypedArray, index: number): T {
    if (array instanceof Int8Array) {
      return Atomics.load(array, index) as T;
    } else if (array instanceof Uint8Array) {
      return Atomics.load(array, index) as T;
    } else if (array instanceof Int16Array) {
      return Atomics.load(array, index) as T;
    } else if (array instanceof Uint16Array) {
      return Atomics.load(array, index) as T;
    } else if (array instanceof Int32Array) {
      return Atomics.load(array, index) as T;
    } else if (array instanceof Uint32Array) {
      return Atomics.load(array, index) as T;
    } else if (array instanceof BigInt64Array) {
      return Atomics.load(array, index) as T;
    } else if (array instanceof BigUint64Array) {
      return Atomics.load(array, index) as T;
    }

    throw new Error('Unsupported array type for atomic load');
  }

  /**
   * Atomic store with memory ordering
   *
   * @param array - Typed array to store to
   * @param index - Index in the array
   * @param value - Value to store
   */
  static store<T>(array: TypedArray, index: number, value: T): void {
    if (array instanceof Int8Array) {
      Atomics.store(array, index, value as number);
    } else if (array instanceof Uint8Array) {
      Atomics.store(array, index, value as number);
    } else if (array instanceof Int16Array) {
      Atomics.store(array, index, value as number);
    } else if (array instanceof Uint16Array) {
      Atomics.store(array, index, value as number);
    } else if (array instanceof Int32Array) {
      Atomics.store(array, index, value as number);
    } else if (array instanceof Uint32Array) {
      Atomics.store(array, index, value as number);
    } else if (array instanceof BigInt64Array) {
      Atomics.store(array, index, value as bigint);
    } else if (array instanceof BigUint64Array) {
      Atomics.store(array, index, value as bigint);
    } else {
      throw new Error('Unsupported array type for atomic store');
    }
  }

  /**
   * Atomic compare and exchange
   *
   * @param array - Typed array to operate on
   * @param index - Index in the array
   * @param expected - Expected value
   * @param replacement - Replacement value
   * @returns Original value at the index
   */
  static compareExchange<T>(
    array: TypedArray,
    index: number,
    expected: T,
    replacement: T
  ): T {
    if (array instanceof Int8Array) {
      return Atomics.compareExchange(
        array,
        index,
        expected as number,
        replacement as number
      ) as T;
    } else if (array instanceof Uint8Array) {
      return Atomics.compareExchange(
        array,
        index,
        expected as number,
        replacement as number
      ) as T;
    } else if (array instanceof Int16Array) {
      return Atomics.compareExchange(
        array,
        index,
        expected as number,
        replacement as number
      ) as T;
    } else if (array instanceof Uint16Array) {
      return Atomics.compareExchange(
        array,
        index,
        expected as number,
        replacement as number
      ) as T;
    } else if (array instanceof Int32Array) {
      return Atomics.compareExchange(
        array,
        index,
        expected as number,
        replacement as number
      ) as T;
    } else if (array instanceof Uint32Array) {
      return Atomics.compareExchange(
        array,
        index,
        expected as number,
        replacement as number
      ) as T;
    } else if (array instanceof BigInt64Array) {
      return Atomics.compareExchange(
        array,
        index,
        expected as bigint,
        replacement as bigint
      ) as T;
    } else if (array instanceof BigUint64Array) {
      return Atomics.compareExchange(
        array,
        index,
        expected as bigint,
        replacement as bigint
      ) as T;
    }

    throw new Error('Unsupported array type for atomic compare exchange');
  }

  /**
   * Atomic add operation
   *
   * @param array - Typed array to operate on
   * @param index - Index in the array
   * @param value - Value to add
   * @returns Previous value at the index
   */
  static add<T>(array: TypedArray, index: number, value: T): T {
    if (array instanceof Int8Array) {
      return Atomics.add(array, index, value as number) as T;
    } else if (array instanceof Uint8Array) {
      return Atomics.add(array, index, value as number) as T;
    } else if (array instanceof Int16Array) {
      return Atomics.add(array, index, value as number) as T;
    } else if (array instanceof Uint16Array) {
      return Atomics.add(array, index, value as number) as T;
    } else if (array instanceof Int32Array) {
      return Atomics.add(array, index, value as number) as T;
    } else if (array instanceof Uint32Array) {
      return Atomics.add(array, index, value as number) as T;
    } else if (array instanceof BigInt64Array) {
      return Atomics.add(array, index, value as bigint) as T;
    } else if (array instanceof BigUint64Array) {
      return Atomics.add(array, index, value as bigint) as T;
    }

    throw new Error('Unsupported array type for atomic add');
  }
}
