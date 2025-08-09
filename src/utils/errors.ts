/**
 * Base Error class for all Gonex errors
 */
export class GonexError extends Error {
  public readonly code: string;
  public readonly context: Record<string, AnyValue>;

  constructor(
    message: string,
    code: string,
    context?: Record<string, AnyValue>
  ) {
    super(message);
    this.name = 'GonexError';
    this.code = code;
    this.context = context || {};

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GonexError);
    }
  }

  /**
   * Convert error to JSON for serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class ChannelError extends GonexError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, AnyValue>
  ) {
    super(message, code, context);
    this.name = 'ChannelError';
  }
}

export class ChannelClosedError extends ChannelError {
  constructor(channelName?: string) {
    super(
      `Channel ${channelName ? `"${channelName}"` : ''} is closed`,
      'CHANNEL_CLOSED',
      { channelName }
    );
    this.name = 'ChannelClosedError';
  }
}

export class ChannelTimeoutError extends ChannelError {
  constructor(timeout: number, channelName?: string) {
    super(
      `Channel operation timed out after ${timeout}ms${channelName ? ` on channel "${channelName}"` : ''}`,
      'CHANNEL_TIMEOUT',
      { timeout, channelName }
    );
    this.name = 'ChannelTimeoutError';
  }
}

export class ChannelBufferFullError extends ChannelError {
  constructor(channelName?: string) {
    super(
      `Channel ${channelName ? `"${channelName}"` : ''} buffer is full`,
      'CHANNEL_BUFFER_FULL',
      { channelName }
    );
    this.name = 'ChannelBufferFullError';
  }
}

export class ContextError extends GonexError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, AnyValue>
  ) {
    super(message, code, context);
    this.name = 'ContextError';
  }
}

export class ContextCancelledError extends ContextError {
  constructor(reason?: string) {
    super(
      `Context was cancelled${reason ? `: ${reason}` : ''}`,
      'CONTEXT_CANCELLED',
      { reason }
    );
    this.name = 'ContextCancelledError';
  }
}

export class ContextTimeoutError extends ContextError {
  constructor(timeout: number) {
    super(`Context timed out after ${timeout}ms`, 'CONTEXT_TIMEOUT', {
      timeout,
    });
    this.name = 'ContextTimeoutError';
  }
}

export class ContextDeadlineExceededError extends ContextError {
  constructor(deadline: Date) {
    super(
      `Context deadline exceeded at ${deadline.toISOString()}`,
      'CONTEXT_DEADLINE_EXCEEDED',
      { deadline }
    );
    this.name = 'ContextDeadlineExceededError';
  }
}

export class MutexError extends GonexError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, AnyValue>
  ) {
    super(message, code, context);
    this.name = 'MutexError';
  }
}

export class MutexLockTimeoutError extends MutexError {
  constructor(timeout: number, mutexName?: string) {
    super(
      `Failed to acquire mutex lock within ${timeout}ms${mutexName ? ` on mutex "${mutexName}"` : ''}`,
      'MUTEX_LOCK_TIMEOUT',
      { timeout, mutexName }
    );
    this.name = 'MutexLockTimeoutError';
  }
}

export class MutexAlreadyLockedError extends MutexError {
  constructor(mutexName?: string) {
    super(
      `Mutex ${mutexName ? `"${mutexName}"` : ''} is already locked`,
      'MUTEX_ALREADY_LOCKED',
      { mutexName }
    );
    this.name = 'MutexAlreadyLockedError';
  }
}

export class MutexNotLockedError extends MutexError {
  constructor(mutexName?: string) {
    super(
      `Mutex ${mutexName ? `"${mutexName}"` : ''} is not locked`,
      'MUTEX_NOT_LOCKED',
      { mutexName }
    );
    this.name = 'MutexNotLockedError';
  }
}

export class WaitGroupError extends GonexError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, AnyValue>
  ) {
    super(message, code, context);
    this.name = 'WaitGroupError';
  }
}

export class WaitGroupNegativeCounterError extends WaitGroupError {
  constructor(counter: number, name?: string) {
    super(
      `WaitGroup counter cannot be negative: ${counter}`,
      'WAITGROUP_NEGATIVE_COUNTER',
      { counter, name }
    );
    this.name = 'WaitGroupNegativeCounterError';
  }
}

export class SemaphoreError extends GonexError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, AnyValue>
  ) {
    super(message, code, context);
    this.name = 'SemaphoreError';
  }
}

export class SemaphoreTimeoutError extends SemaphoreError {
  constructor(timeout: number, semaphoreName?: string) {
    super(
      `Failed to acquire semaphore within ${timeout}ms${semaphoreName ? ` on semaphore "${semaphoreName}"` : ''}`,
      'SEMAPHORE_TIMEOUT',
      { timeout, semaphoreName }
    );
    this.name = 'SemaphoreTimeoutError';
  }
}

export class ValidationError extends GonexError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, AnyValue>
  ) {
    super(message, code, context);
    this.name = 'ValidationError';
  }
}

export class InvalidTimeoutError extends ValidationError {
  constructor(timeout: AnyValue, name?: string) {
    super(
      `Invalid timeout value: ${timeout}${name ? ` for ${name}` : ''}. Must be a positive number or -1 for infinite`,
      'INVALID_TIMEOUT',
      { timeout, name }
    );
    this.name = 'InvalidTimeoutError';
  }
}

export class InvalidBufferSizeError extends ValidationError {
  constructor(size: AnyValue, name?: string) {
    super(
      `Invalid buffer size: ${size}${name ? ` for ${name}` : ''}. Must be a non-negative integer`,
      'INVALID_BUFFER_SIZE',
      { size, name }
    );
    this.name = 'InvalidBufferSizeError';
  }
}

export class InvalidConcurrencyError extends ValidationError {
  constructor(level: AnyValue, name?: string) {
    super(
      `Invalid concurrency level: ${level}${name ? ` for ${name}` : ''}. Must be a positive integer`,
      'INVALID_CONCURRENCY_LEVEL',
      { level, name }
    );
    this.name = 'InvalidConcurrencyError';
  }
}

export class RWMutexError extends GonexError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, AnyValue>
  ) {
    super(message, code, context);
    this.name = 'RWMutexError';
  }
}

export class RWMutexReadLockTimeoutError extends RWMutexError {
  constructor(timeout: number, mutexName?: string) {
    super(
      `Failed to acquire read lock within ${timeout}ms${mutexName ? ` on RWMutex "${mutexName}"` : ''}`,
      'RWMUTEX_READ_LOCK_TIMEOUT',
      { timeout, mutexName }
    );
    this.name = 'RWMutexReadLockTimeoutError';
  }
}

export class RWMutexWriteLockTimeoutError extends RWMutexError {
  constructor(timeout: number, mutexName?: string) {
    super(
      `Failed to acquire write lock within ${timeout}ms${mutexName ? ` on RWMutex "${mutexName}"` : ''}`,
      'RWMUTEX_WRITE_LOCK_TIMEOUT',
      { timeout, mutexName }
    );
    this.name = 'RWMutexWriteLockTimeoutError';
  }
}

export class RWMutexNotReadLockedError extends RWMutexError {
  constructor(mutexName?: string) {
    super(
      `RWMutex ${mutexName ? `"${mutexName}"` : ''} does not have a read lock to release`,
      'RWMUTEX_NOT_READ_LOCKED',
      { mutexName }
    );
    this.name = 'RWMutexNotReadLockedError';
  }
}

export class RWMutexNotWriteLockedError extends RWMutexError {
  constructor(mutexName?: string) {
    super(
      `RWMutex ${mutexName ? `"${mutexName}"` : ''} does not have a write lock to release`,
      'RWMUTEX_NOT_WRITE_LOCKED',
      { mutexName }
    );
    this.name = 'RWMutexNotWriteLockedError';
  }
}

export class RWMutexTooManyReadersError extends RWMutexError {
  constructor(maxReaders: number, mutexName?: string) {
    super(
      `RWMutex ${mutexName ? `"${mutexName}"` : ''} has reached maximum readers limit: ${maxReaders}`,
      'RWMUTEX_TOO_MANY_READERS',
      { maxReaders, mutexName }
    );
    this.name = 'RWMutexTooManyReadersError';
  }
}
