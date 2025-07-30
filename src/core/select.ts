import { INFINITE_TIMEOUT, validateTimeout } from '../utils';
import { Channel } from './channel';

/**
 * Represents a select case for channel operations
 */
export type SelectCase<T> = {
  /** channel to operate on */
  channel: Channel<T>;
  /** Operation type: 'send' or 'receive' */
  operation: 'send' | 'receive';
  /** Value to send (required for send operations) */
  value?: T;
  /** Optional handler called when this case is selected */
  handler?: ((value: T) => void) | undefined;
};

/**
 * Options for configuring select behavior
 */
export type SelectOptions = {
  /** Timeout in milliseconds for the entire select operation (-1 for infinite) */
  timeout?: number;
  /** Default case executed when no channels are ready */
  default?: () => void;
};

/**
 * High-performance select implementation for non-blocking channel operations
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast polling with exponential backoff
 * - Efficient case management
 * - Lock-free operations where possible
 *
 * Similar to Go's select statement but adapted for Node.js event loop
 */
export async function select<T>(
  cases: SelectCase<T>[],
  options: SelectOptions = {}
): Promise<T> {
  const { timeout = INFINITE_TIMEOUT, default: defaultCase } = options;

  // Validate timeout if provided
  if (timeout !== INFINITE_TIMEOUT) {
    validateTimeout(timeout, 'select timeout');
  }

  // Fast path: try all cases immediately
  for (let i = 0; i < cases.length; i++) {
    const selectCase = cases[i];
    if (!selectCase) continue;
    const result = trySelectCase(selectCase);
    if (result !== null) {
      return result;
    }
  }

  // Fast path: execute default case if provided
  if (defaultCase) {
    defaultCase();
    return undefined as AnyValue;
  }

  // Slow path: poll with exponential backoff
  return pollSelectCases(cases, timeout);
}

/**
 * Try to execute a select case immediately
 *
 * Fast path operation with minimal overhead
 *
 * @param selectCase - The select case to try
 * @returns The result if successful, null otherwise
 */
function trySelectCase<T>(selectCase: SelectCase<T>): T | null {
  const { channel, operation, value, handler } = selectCase;

  if (operation === 'send') {
    if (value === undefined) {
      throw new Error('Value is required for send operations');
    }

    if (channel.trySend(value)) {
      if (handler) {
        handler(value);
      }
      return value;
    }
  } else if (operation === 'receive') {
    const received = channel.tryReceive();
    if (received !== undefined) {
      if (handler) {
        handler(received);
      }
      return received;
    }
  }
  return null;
}

/**
 * Poll select cases with exponential backoff
 *
 * Optimized polling strategy to minimize CPU usage while maintaining responsiveness
 *
 * @param cases - Array of select cases
 * @param timeout - Overall timeout for the operation
 * @returns Promise that resolves with the first successful case result
 */
async function pollSelectCases<T>(
  cases: SelectCase<T>[],
  timeout: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let pollInterval = 1; // Start with 1ms
    const maxPollInterval = 100; // Cap at 100ms
    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;

    // Set up timeout if specified
    if (timeout !== INFINITE_TIMEOUT) {
      timeoutId = setTimeout(() => {
        reject(new Error(`Select operation timed out after ${timeout}ms`));
      }, timeout);
    }

    /** Poll function with exponential backoff */
    function poll() {
      // Check if timeout has been reached
      if (timeout !== INFINITE_TIMEOUT && Date.now() - startTime >= timeout) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(new Error(`Select operation timed out after ${timeout}ms`));
        return;
      }

      // Try all cases
      for (let i = 0; i < cases.length; i++) {
        const result = trySelectCase(cases[i]!);
        if (result !== null) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          resolve(result);
          return;
        }
      }

      // Schedule next poll with exponential backoff
      setTimeout(poll, pollInterval);

      // Increase poll interval (exponential backoff)
      pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
    }

    // Start polling
    poll();
  });
}

/**
 * Create a select case for receiving from a channel
 *
 * Convenience function for creating receive cases
 *
 * @param channel - Channel to receive from
 * @param handler - Optional handler for the received value
 * @returns SelectCase for receiving
 */
export function receive<T>(
  channel: Channel<T>,
  handler?: (value: T) => void
): SelectCase<T> {
  return {
    channel,
    operation: 'receive',
    handler,
  };
}

/**
 * Create a select case for sending to a channel
 *
 * Convenience function for creating send cases
 *
 * @param channel - Channel to send to
 * @param value - Value to send
 * @param handler - Optional handler for the send operation
 * @returns SelectCase for sending
 */
export function send<T>(
  channel: Channel<T>,
  value: T,
  handler?: (value: T) => void
): SelectCase<T> {
  return {
    channel,
    operation: 'send',
    value,
    handler,
  };
}

/**
 * Execute select with a default case when no channels are ready
 *
 * Convenience function for common select pattern
 *
 * @param cases - Array of select cases
 * @param defaultCase - Function to execute when no channels are ready
 * @returns Promise that resolves with the first successful case result
 */
export async function selectWithDefault<T>(
  cases: SelectCase<T>[],
  defaultCase: () => void
): Promise<T> {
  return select(cases, { default: defaultCase });
}

/**
 * Execute select with a timeout
 *
 * Convenience function for select with timeout
 *
 * @param cases - Array of select cases
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves with the first successful case result
 */
export async function selectWithTimeout<T>(
  cases: SelectCase<T>[],
  timeout: number
): Promise<T> {
  return select(cases, { timeout });
}
