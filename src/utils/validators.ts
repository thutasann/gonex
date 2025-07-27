import {
  MAX_CHANNEL_BUFFER,
  MAX_TIMEOUT,
  MAX_WORKER_POOL_SIZE,
  MIN_BUFFER_SIZE,
  MIN_CONCURRENCY_LEVEL,
  MIN_POOL_SIZE,
  MIN_TIMEOUT,
} from './constants';
import {
  InvalidBufferSizeError,
  InvalidConcurrencyError,
  InvalidTimeoutError,
  ValidationError,
} from './errors';

export function validateTimeout(timeout: number, name?: string): void {
  if (typeof timeout !== 'number' || isNaN(timeout)) {
    throw new InvalidTimeoutError(timeout, name);
  }

  if (timeout !== -1 && (timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT)) {
    throw new InvalidTimeoutError(timeout, name);
  }
}

export function validateDeadline(deadline: Date, name?: string): void {
  if (!(deadline instanceof Date) || isNaN(deadline.getTime())) {
    throw new ValidationError(
      `Invalid deadline: ${deadline}${name ? ` for ${name}` : ''}. Must be a valid Date`,
      'INVALID_DEADLINE',
      { deadline, name }
    );
  }
}

export function validateDuration(duration: number, name?: string): void {
  if (typeof duration !== 'number' || isNaN(duration) || duration < 0) {
    throw new ValidationError(
      `Invalid duration: ${duration}${name ? ` for ${name}` : ''}. Must be a non-negative number`,
      'INVALID_DURATION',
      { duration, name }
    );
  }
}

export function validateBufferSize(size: number, name?: string): void {
  if (typeof size !== 'number' || isNaN(size) || !Number.isInteger(size)) {
    throw new InvalidBufferSizeError(size, name);
  }

  if (size < MIN_BUFFER_SIZE || size > MAX_CHANNEL_BUFFER) {
    throw new InvalidBufferSizeError(size, name);
  }
}

export function validateConcurrencyLevel(level: number, name?: string): void {
  if (typeof level !== 'number' || isNaN(level) || !Number.isInteger(level)) {
    throw new InvalidConcurrencyError(level, name);
  }

  if (level < MIN_CONCURRENCY_LEVEL || level > MAX_WORKER_POOL_SIZE) {
    throw new InvalidConcurrencyError(level, name);
  }
}

export function validatePoolSize(size: number, name?: string): void {
  if (typeof size !== 'number' || isNaN(size) || !Number.isInteger(size)) {
    throw new ValidationError(
      `Invalid pool size: ${size}${name ? ` for ${name}` : ''}. Must be a positive integer`,
      'INVALID_POOL_SIZE',
      { size, name }
    );
  }

  if (size < MIN_POOL_SIZE || size > MAX_WORKER_POOL_SIZE) {
    throw new ValidationError(
      `Invalid pool size: ${size}${name ? ` for ${name}` : ''}. Must be between ${MIN_POOL_SIZE} and ${MAX_WORKER_POOL_SIZE}`,
      'INVALID_POOL_SIZE',
      { size, name }
    );
  }
}

export type ChannelOptions = {
  /** Buffer size for the channel (0 for unbuffered) */
  bufferSize?: number;
  /** Default timeout for send/receive operations in milliseconds */
  timeout?: number;
  /** Optional name for debugging and error reporting */
  name?: string;
};

export function validateChannelOptions(options: ChannelOptions): void {
  if (options.bufferSize !== undefined) {
    validateBufferSize(options.bufferSize, options.name);
  }

  if (options.timeout !== undefined) {
    validateTimeout(options.timeout, options.name);
  }
}

export function validateChannelOperation(operation: 'send' | 'receive'): void {
  if (operation !== 'send' && operation !== 'receive') {
    throw new ValidationError(
      `Invalid channel operation: ${operation}. Must be 'send' or 'receive'`,
      'INVALID_CHANNEL_OPERATION',
      { operation }
    );
  }
}

export type ContextOptions = {
  timeout?: number;
  deadline?: Date;
  values?: Record<string, AnyValue>;
};

export function validateContextOptions(options: ContextOptions): void {
  if (options.timeout !== undefined) {
    validateTimeout(options.timeout);
  }

  if (options.deadline !== undefined) {
    validateDeadline(options.deadline);
  }
}

export function validateContextValues(values: Record<string, AnyValue>): void {
  if (values !== null && typeof values !== 'object') {
    throw new ValidationError(
      `Invalid context values: ${values}. Must be an object or null`,
      'INVALID_CONTEXT_VALUES',
      { values }
    );
  }
}

export type WorkerPoolOptions = {
  size: number;
  timeout?: number;
  name?: string;
};

export function validateWorkerPoolOptions(options: WorkerPoolOptions): void {
  validatePoolSize(options.size, options.name);

  if (options.timeout !== undefined) {
    validateTimeout(options.timeout, options.name);
  }
}

export type RateLimiterOptions = {
  limit: number;
  timeWindow: number;
  burstSize?: number;
};

export function validateRateLimiterOptions(options: RateLimiterOptions): void {
  if (typeof options.limit !== 'number' || options.limit <= 0) {
    throw new ValidationError(
      `Invalid rate limit: ${options.limit}. Must be a positive number`,
      'INVALID_RATE_LIMIT',
      { limit: options.limit }
    );
  }

  if (typeof options.timeWindow !== 'number' || options.timeWindow <= 0) {
    throw new ValidationError(
      `Invalid time window: ${options.timeWindow}. Must be a positive number`,
      'INVALID_TIME_WINDOW',
      { timeWindow: options.timeWindow }
    );
  }

  if (options.burstSize !== undefined) {
    if (typeof options.burstSize !== 'number' || options.burstSize <= 0) {
      throw new ValidationError(
        `Invalid burst size: ${options.burstSize}. Must be a positive number`,
        'INVALID_BURST_SIZE',
        { burstSize: options.burstSize }
      );
    }
  }
}

export type CircuitBreakerOptions = {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenLimit?: number;
};

export function validateCircuitBreakerOptions(
  options: CircuitBreakerOptions
): void {
  if (
    typeof options.failureThreshold !== 'number' ||
    options.failureThreshold <= 0
  ) {
    throw new ValidationError(
      `Invalid failure threshold: ${options.failureThreshold}. Must be a positive number`,
      'INVALID_FAILURE_THRESHOLD',
      { failureThreshold: options.failureThreshold }
    );
  }

  if (
    typeof options.recoveryTimeout !== 'number' ||
    options.recoveryTimeout <= 0
  ) {
    throw new ValidationError(
      `Invalid recovery timeout: ${options.recoveryTimeout}. Must be a positive number`,
      'INVALID_RECOVERY_TIMEOUT',
      { recoveryTimeout: options.recoveryTimeout }
    );
  }

  if (options.halfOpenLimit !== undefined) {
    if (
      typeof options.halfOpenLimit !== 'number' ||
      options.halfOpenLimit <= 0
    ) {
      throw new ValidationError(
        `Invalid half-open limit: ${options.halfOpenLimit}. Must be a positive number`,
        'INVALID_HALF_OPEN_LIMIT',
        { halfOpenLimit: options.halfOpenLimit }
      );
    }
  }
}

export type RetryOptions = {
  maxRetries: number;
  delay: number;
  backoffFactor?: number;
  maxDelay?: number;
};

export function validateRetryOptions(options: RetryOptions): void {
  if (typeof options.maxRetries !== 'number' || options.maxRetries < 0) {
    throw new ValidationError(
      `Invalid max retries: ${options.maxRetries}. Must be a non-negative number`,
      'INVALID_MAX_RETRIES',
      { maxRetries: options.maxRetries }
    );
  }

  if (typeof options.delay !== 'number' || options.delay < 0) {
    throw new ValidationError(
      `Invalid delay: ${options.delay}. Must be a non-negative number`,
      'INVALID_DELAY',
      { delay: options.delay }
    );
  }

  if (options.backoffFactor !== undefined) {
    if (
      typeof options.backoffFactor !== 'number' ||
      options.backoffFactor <= 0
    ) {
      throw new ValidationError(
        `Invalid backoff factor: ${options.backoffFactor}. Must be a positive number`,
        'INVALID_BACKOFF_FACTOR',
        { backoffFactor: options.backoffFactor }
      );
    }
  }

  if (options.maxDelay !== undefined) {
    if (typeof options.maxDelay !== 'number' || options.maxDelay < 0) {
      throw new ValidationError(
        `Invalid max delay: ${options.maxDelay}. Must be a non-negative number`,
        'INVALID_MAX_DELAY',
        { maxDelay: options.maxDelay }
      );
    }
  }
}
