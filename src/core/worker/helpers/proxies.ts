/**
 * Create a proxy context object for worker threads
 */
export function createProxyContext(serializedContext: AnyValue): AnyValue {
  if (
    !serializedContext ||
    typeof serializedContext !== 'object' ||
    !serializedContext.__isContext
  ) {
    return serializedContext;
  }

  return {
    deadline: () => serializedContext.deadline || [undefined, false],
    done: () => null,
    err: () => serializedContext.err || null,
    value: () => null,
    __isProxyContext: true,
    __originalContext: serializedContext,
  };
}

/**
 * Create context proxy for execution
 */
export function createContextProxy(): string {
  return `
      const resolvedArgs = args.map(arg => {
        if (typeof arg === 'string' && arg.startsWith('arg_func_') && globalThis[arg]) {
          return globalThis[arg];
        } else if (arg && typeof arg === 'object' && arg.__isContext) {
          const contextId = arg.contextId;
          const contextValues = arg.values || {};
          
          return {
            deadline: () => {
              const state = contextStateRegistry.get(contextId);
              return state ? state.deadline : (arg.deadline || [undefined, false]);
            },
            done: () => null,
            err: () => {
              const state = contextStateRegistry.get(contextId);
              return state ? state.err : (arg.err || null);
            },
            value: (key) => {
              if (contextValues[key] !== undefined) {
                return contextValues[key];
              }
              
              const state = contextStateRegistry.get(contextId);
              if (state && state.values && state.values[key] !== undefined) {
                return state.values[key];
              }
              
              return null;
            },
            __isProxyContext: true,
            __originalContext: arg,
            __contextId: contextId,
            __contextValues: contextValues,
          };
        } else if (arg && typeof arg === 'object' && arg.__isRWMutex) {
          return {
            async rLock(timeout) {
              throw new Error(
                'RWMutex operations are not supported across worker thread boundaries. ' +
                'Please use RWMutex synchronization in the main thread and pass results to workers.'
              );
            },
            rUnlock() {
              throw new Error(
                'RWMutex operations are not supported across worker thread boundaries. ' +
                'Please use RWMutex synchronization in the main thread and pass results to workers.'
              );
            },
            async lock(timeout) {
              throw new Error(
                'RWMutex operations are not supported across worker thread boundaries. ' +
                'Please use RWMutex synchronization in the main thread and pass results to workers.'
              );
            },
            unlock() {
              throw new Error(
                'RWMutex operations are not supported across worker thread boundaries. ' +
                'Please use RWMutex synchronization in the main thread and pass results to workers.'
              );
            },
            tryRLock() {
              throw new Error(
                'RWMutex operations are not supported across worker thread boundaries. ' +
                'Please use RWMutex synchronization in the main thread and pass results to workers.'
              );
            },
            tryLock() {
              throw new Error(
                'RWMutex operations are not supported across worker thread boundaries. ' +
                'Please use RWMutex synchronization in the main thread and pass results to workers.'
              );
            },
            getState() {
              return arg.state || {
                readerCount: 0,
                writerLocked: false,
                writerWaiting: false,
                pendingReaders: 0,
                pendingWriters: 0,
              };
            },
            isLocked() {
              const state = this.getState();
              return state.readerCount > 0 || state.writerLocked;
            },
            isReadLocked() {
              return this.getState().readerCount > 0;
            },
            isWriteLocked() {
              return this.getState().writerLocked;
            },
            __isProxyRWMutex: true,
            __originalMutex: arg,
          };
        } else if (arg && typeof arg === 'object' && arg.__isMutex) {
          return {
            async lock(timeout) {
              // Note: This is a simplified implementation for worker threads
              console.warn('⚠️  Mutex in worker thread - limited synchronization guarantees');
              if (timeout && timeout > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 10)));
              }
              return Promise.resolve();
            },
            unlock() {
              // Note: This is a simplified implementation for worker threads
              console.warn('⚠️  Mutex unlock in worker thread - limited synchronization guarantees');
              // No-op for worker thread mutex
            },
            tryLock() {
              // Note: This is a simplified implementation for worker threads
              console.warn('⚠️  Mutex tryLock in worker thread - limited synchronization guarantees');
              return true; // Always succeeds in worker thread context
            },
            isLocked() {
              return arg.isLocked || false;
            },
            __isProxyMutex: true,
            __originalMutex: arg,
          };
        } else if (arg && typeof arg === 'object' && arg.__isChannel) {
          return createProxyChannel(arg);
        } else if (arg && typeof arg === 'object' && arg.__isSemaphore) {
          return createProxySemaphore(arg);
        }
        return arg;
      });
    `;
}

/**
 * Create a proxy RWMutex object for worker threads
 */
export function createProxyRWMutex(serializedMutex: AnyValue): AnyValue {
  if (
    !serializedMutex ||
    typeof serializedMutex !== 'object' ||
    !serializedMutex.__isRWMutex
  ) {
    return serializedMutex;
  }

  // Create a proxy that throws meaningful errors for unsupported operations
  return {
    async rLock(timeout?: number): Promise<void> {
      throw new Error(
        'RWMutex operations are not supported across worker thread boundaries. ' +
          'Please use RWMutex synchronization in the main thread and pass results to workers.' +
          `\n\nTimeout: ${timeout}`
      );
    },
    rUnlock(): void {
      throw new Error(
        'RWMutex operations are not supported across worker thread boundaries. ' +
          'Please use RWMutex synchronization in the main thread and pass results to workers.'
      );
    },
    async lock(timeout?: number): Promise<void> {
      throw new Error(
        'RWMutex operations are not supported across worker thread boundaries. ' +
          'Please use RWMutex synchronization in the main thread and pass results to workers.' +
          `\n\nTimeout: ${timeout}`
      );
    },
    unlock(): void {
      throw new Error(
        'RWMutex operations are not supported across worker thread boundaries. ' +
          'Please use RWMutex synchronization in the main thread and pass results to workers.'
      );
    },
    tryRLock(): boolean {
      throw new Error(
        'RWMutex operations are not supported across worker thread boundaries. ' +
          'Please use RWMutex synchronization in the main thread and pass results to workers.'
      );
    },
    tryLock(): boolean {
      throw new Error(
        'RWMutex operations are not supported across worker thread boundaries. ' +
          'Please use RWMutex synchronization in the main thread and pass results to workers.'
      );
    },
    getState() {
      return (
        serializedMutex.state || {
          readerCount: 0,
          writerLocked: false,
          writerWaiting: false,
          pendingReaders: 0,
          pendingWriters: 0,
        }
      );
    },
    isLocked(): boolean {
      const state = this.getState();
      return state.readerCount > 0 || state.writerLocked;
    },
    isReadLocked(): boolean {
      return this.getState().readerCount > 0;
    },
    isWriteLocked(): boolean {
      return this.getState().writerLocked;
    },
    __isProxyRWMutex: true,
    __originalMutex: serializedMutex,
  };
}

/**
 * Create a proxy Channel object for worker threads
 */
export function createProxyChannel(serializedChannel: AnyValue): AnyValue {
  if (
    !serializedChannel ||
    typeof serializedChannel !== 'object' ||
    !serializedChannel.__isChannel
  ) {
    return serializedChannel;
  }

  // Create a simple proxy that throws errors for operations that can't work across threads
  return {
    async send(value: AnyValue, timeout?: number): Promise<void> {
      throw new Error(
        'Channel send operations are not supported across worker thread boundaries. ' +
          'Please use channel operations in the main thread and pass results to workers.' +
          `\n\nValue: ${value}` +
          `\n\nTimeout: ${timeout}`
      );
    },
    async receive(timeout?: number): Promise<AnyValue> {
      throw new Error(
        'Channel receive operations are not supported across worker thread boundaries. ' +
          'Please use channel operations in the main thread and pass results to workers.' +
          `\n\nTimeout: ${timeout}`
      );
    },
    trySend(value?: AnyValue): boolean {
      // For select operations, return false to indicate the operation can't proceed
      if (value !== undefined) {
        throw new Error(
          'Channel send operations are not supported across worker thread boundaries. ' +
            'Please use channel operations in the main thread and pass results to workers.' +
            `\n\nValue: ${value}`
        );
      }
      return false;
    },
    tryReceive(): AnyValue {
      // For select operations, return undefined to indicate no value available
      return undefined;
    },
    close(): void {
      throw new Error(
        'Channel close operations are not supported across worker thread boundaries.' +
          `\n\nChannel ID: ${serializedChannel.channelId}`
      );
    },
    isClosed(): boolean {
      return serializedChannel.isClosed || false;
    },
    length(): number {
      return serializedChannel.length || 0;
    },
    capacity(): number {
      return serializedChannel.bufferSize || 0;
    },
    __isProxyChannel: true,
    __originalChannel: serializedChannel,
  };
}

/**
 * Create a proxy Mutex object for worker threads
 */
export function createProxyMutex(serializedMutex: AnyValue): AnyValue {
  if (
    !serializedMutex ||
    typeof serializedMutex !== 'object' ||
    !serializedMutex.__isMutex
  ) {
    return serializedMutex;
  }

  return {
    async lock(timeout?: number): Promise<void> {
      // Note: This is a simplified implementation for worker threads
      // It won't provide true cross-thread synchronization but allows basic functionality
      console.warn(
        '⚠️  Mutex in worker thread - limited synchronization guarantees'
      );
      // Simulate lock delay
      if (timeout && timeout > 0) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.min(timeout, 10))
        );
      }
      return Promise.resolve();
    },
    unlock(): void {
      // Note: This is a simplified implementation for worker threads
      console.warn(
        '⚠️  Mutex unlock in worker thread - limited synchronization guarantees'
      );
      // No-op for worker thread mutex
    },
    tryLock(): boolean {
      // Note: This is a simplified implementation for worker threads
      console.warn(
        '⚠️  Mutex tryLock in worker thread - limited synchronization guarantees'
      );
      return true; // Always succeeds in worker thread context
    },
    isLocked(): boolean {
      return serializedMutex.isLocked || false;
    },
    __isProxyMutex: true,
    __originalMutex: serializedMutex,
  };
}

/**
 * Create a proxy Semaphore object for worker threads
 */
export function createProxySemaphore(serializedSemaphore: AnyValue): AnyValue {
  if (
    !serializedSemaphore ||
    typeof serializedSemaphore !== 'object' ||
    !serializedSemaphore.__isSemaphore
  ) {
    return serializedSemaphore;
  }

  return {
    async acquire(timeout?: number): Promise<void> {
      // Note: This is a simplified implementation for worker threads
      console.warn(
        '⚠️  Semaphore in worker thread - limited synchronization guarantees'
      );
      // Simulate acquire delay based on available permits
      const permits = serializedSemaphore.availablePermits || 0;
      if (permits <= 0) {
        // Simulate waiting when no permits available
        const delay = Math.min(timeout || 100, 50);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return Promise.resolve();
    },
    release(): void {
      // Note: This is a simplified implementation for worker threads
      console.warn(
        '⚠️  Semaphore release in worker thread - limited synchronization guarantees'
      );
      // No-op for worker thread semaphore
    },
    tryAcquire(): boolean {
      // Note: This is a simplified implementation for worker threads
      console.warn(
        '⚠️  Semaphore tryAcquire in worker thread - limited synchronization guarantees'
      );
      // Always succeeds in worker thread context for demo purposes
      return true;
    },
    getAvailablePermits(): number {
      return serializedSemaphore.availablePermits || 0;
    },
    getMaxPermits(): number {
      return serializedSemaphore.maxPermits || 1;
    },
    waitingCount(): number {
      return serializedSemaphore.waitingCount || 0;
    },
    isFullyUtilized(): boolean {
      return serializedSemaphore.isFullyUtilized || false;
    },
    reset(): void {
      console.warn(
        '⚠️  Semaphore reset in worker thread - no effect on main thread semaphore'
      );
      // No-op for worker thread semaphore
    },
    __isProxySemaphore: true,
    __originalSemaphore: serializedSemaphore,
  };
}
