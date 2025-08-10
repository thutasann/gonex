/**
 * Shared Memory Module - Core infrastructure for efficient inter-thread communication
 * using SharedArrayBuffer and atomic operations.
 */
export * from './atomics';
export * from './buffer';
export * from './manager';

export type {
  BufferMetadata,
  MemoryUsage,
  SharedMemoryConfig,
} from './manager';

export type { BufferHeader, BufferStats } from './buffer';

export type { TypedArray } from './atomics';

export { BufferFlags } from './buffer';
