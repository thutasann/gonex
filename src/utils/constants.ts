/**
 * Default timeout values in milliseconds
 */
export const DEFAULT_TIMEOUT = 5000; // 5 seconds
export const DEFAULT_CHANNEL_TIMEOUT = 1000; // 1 second
export const DEFAULT_MUTEX_TIMEOUT = 3000; // 3 seconds
export const DEFAULT_SEMAPHORE_TIMEOUT = 2000; // 2 seconds
export const INFINITE_TIMEOUT = -1; // No timeout
export const MAX_TIMEOUT = 86400000; // 24 hours

/**
 * Buffer size constants
 */
export const DEFAULT_CHANNEL_BUFFER = 0; // Unbuffered by default
export const MAX_CHANNEL_BUFFER = 1000000; // 1 million items
export const DEFAULT_WORKER_POOL_SIZE = 10; // Default pool size
export const MAX_WORKER_POOL_SIZE = 10000; // Maximum pool size

/**
 * Retry configuration constants
 */
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY = 1000; // 1 second
export const MAX_RETRY_DELAY = 30000; // 30 seconds
export const DEFAULT_BACKOFF_FACTOR = 2; // Exponential backoff

/**
 * Rate limiting constants
 */
export const DEFAULT_RATE_LIMIT = 100; // 100 requests
export const DEFAULT_TIME_WINDOW = 60000; // 1 minute
export const DEFAULT_BURST_SIZE = 10; // Burst allowance

/**
 * Circuit breaker constants
 */
export const DEFAULT_FAILURE_THRESHOLD = 5;
export const DEFAULT_RECOVERY_TIMEOUT = 60000; // 1 minute
export const DEFAULT_HALF_OPEN_LIMIT = 3; // Test requests

/**
 * Validation constants
 */
export const MIN_TIMEOUT = 0;
export const MIN_BUFFER_SIZE = 0;
export const MIN_CONCURRENCY_LEVEL = 1;
export const MIN_POOL_SIZE = 1;
