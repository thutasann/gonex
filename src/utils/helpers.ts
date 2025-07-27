import { validateDuration } from './validators';

/**
 * Sleep function for cooperative yielding
 * @param duration - Duration to sleep in milliseconds
 * @returns Promise that resolves after the specified duration
 */
export function sleep(duration: number): Promise<void> {
  validateDuration(duration, 'sleep duration');

  return new Promise(resolve => {
    setTimeout(resolve, duration);
  });
}

/**
 * Create a promise that times out after a specified duration
 * @param promise - The promise to wrap
 * @param timeout - Timeout duration in milliseconds
 * @returns Promise that either resolves with the original promise result or rejects with a timeout error
 */
export function createTimeoutPromise<T>(
  promise: Promise<T>,
  timeout: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeout}ms`));
    }, timeout);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Create a cancellable promise using AbortSignal
 * @param promise - The promise to wrap
 * @param signal - AbortSignal for cancellation
 * @returns Promise that can be cancelled via the signal
 */
export function createCancellablePromise<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Operation was aborted'));
      return;
    }

    const abortHandler = () => {
      reject(new Error('Operation was aborted'));
    };

    signal.addEventListener('abort', abortHandler, { once: true });

    promise
      .then(result => {
        signal.removeEventListener('abort', abortHandler);
        resolve(result);
      })
      .catch(error => {
        signal.removeEventListener('abort', abortHandler);
        reject(error);
      });
  });
}

export function isPromise(value: any): value is Promise<any> {
  return value && typeof value.then === 'function';
}

export function isAsyncFunction(value: any): value is Function {
  return (
    typeof value === 'function' && value.constructor.name === 'AsyncFunction'
  );
}

export function isValidTimeout(timeout: any): timeout is number {
  return (
    typeof timeout === 'number' &&
    !isNaN(timeout) &&
    (timeout === -1 || (timeout >= 0 && timeout <= 86400000))
  );
}

export function isValidBufferSize(size: any): size is number {
  return (
    typeof size === 'number' &&
    !isNaN(size) &&
    Number.isInteger(size) &&
    size >= 0 &&
    size <= 1000000
  );
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj != 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }

  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        (cloned as any)[key] = deepClone((obj as any)[key]);
      }
    }
    return cloned;
  }

  return obj;
}

export function mergeOptions<T>(defaults: T, options: Partial<T>): T {
  const result = deepClone(defaults);

  if (options && typeof options === 'object') {
    for (const key in options) {
      if (options.hasOwnProperty(key) && options[key] !== undefined) {
        (result as any)[key] = options[key];
      }
    }
  }

  return result;
}

export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (key in (obj as any)) {
      result[key] = obj[key];
    }
  }

  return result;
}

export function nextTick(): Promise<void> {
  return new Promise(resolve => {
    process.nextTick(resolve);
  });
}

export function setImmediateFn(): Promise<void> {
  return new Promise(resolve => {
    setImmediate(resolve);
  });
}

export function yieldFn(): Promise<void> {
  return nextTick();
}
