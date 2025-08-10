/**
 * @file src/core/shared-channels/index.ts
 *
 * Shared Channels Module - Thread-safe channel implementations for inter-thread
 * communication using shared memory infrastructure.
 */

export * from './broadcast';
export * from './ring-buffer';
export * from './shared-channel';

export type { ChannelState, SharedChannelConfig } from './shared-channel';

export type { RingBufferConfig, RingBufferStats } from './ring-buffer';

export type {
  BroadcastChannelConfig,
  BroadcastMessage,
  SubscriberInfo,
} from './broadcast';
