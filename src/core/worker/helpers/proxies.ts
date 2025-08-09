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
              throw new Error(
                'Mutex operations are not supported across worker thread boundaries. ' +
                'Please use Mutex synchronization in the main thread and pass results to workers.'
              );
            },
            unlock() {
              throw new Error(
                'Mutex operations are not supported across worker thread boundaries. ' +
                'Please use Mutex synchronization in the main thread and pass results to workers.'
              );
            },
            tryLock() {
              throw new Error(
                'Mutex operations are not supported across worker thread boundaries. ' +
                'Please use Mutex synchronization in the main thread and pass results to workers.'
              );
            },
            isLocked() {
              return arg.isLocked || false;
            },
            __isProxyMutex: true,
            __originalMutex: arg,
          };
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
      throw new Error(
        'Mutex operations are not supported across worker thread boundaries. ' +
          'Please use Mutex synchronization in the main thread and pass results to workers.' +
          `\n\nTimeout: ${timeout}`
      );
    },
    unlock(): void {
      throw new Error(
        'Mutex operations are not supported across worker thread boundaries. ' +
          'Please use Mutex synchronization in the main thread and pass results to workers.'
      );
    },
    tryLock(): boolean {
      throw new Error(
        'Mutex operations are not supported across worker thread boundaries. ' +
          'Please use Mutex synchronization in the main thread and pass results to workers.'
      );
    },
    isLocked(): boolean {
      return serializedMutex.isLocked || false;
    },
    __isProxyMutex: true,
    __originalMutex: serializedMutex,
  };
}
