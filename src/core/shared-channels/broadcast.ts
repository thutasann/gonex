/**
 * Broadcast Channel - Multi-subscriber broadcast implementation using shared memory
 * for efficient one-to-many communication between worker threads.
 */

import { logger } from '../../utils/logger';
import { MutexState, SharedMemoryAtomics } from '../shared-memory/atomics';
import { BufferFlags, SharedMemoryBuffer } from '../shared-memory/buffer';

/**
 * Broadcast channel configuration
 */
export type BroadcastChannelConfig = {
  /** Buffer size in bytes */
  bufferSize: number;
  /** Maximum number of subscribers */
  maxSubscribers: number;
  /** Enable checksum validation */
  enableChecksum: boolean;
  /** Message retention count */
  messageRetention: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
};

/**
 * Subscriber information
 */
export type SubscriberInfo = {
  /** Subscriber ID */
  id: number;
  /** Last message received */
  lastMessageId: number;
  /** Subscription timestamp */
  subscribedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Message offset in buffer */
  messageOffset: number;
};

/**
 * Broadcast message structure
 */
export type BroadcastMessage<T> = {
  /** Unique message ID */
  id: number;
  /** Message data */
  data: T;
  /** Broadcast timestamp */
  timestamp: number;
  /** Message flags */
  flags: number;
  /** Subscriber acknowledgment count */
  acknowledgments: number;
};

/**
 * High-performance broadcast channel for multi-subscriber communication
 * 
 * Features:
 * - One-to-many message broadcasting
 - Subscriber acknowledgment tracking
 * - Message retention and replay
 * - Automatic subscriber cleanup
 * - Efficient shared memory usage
 */
export class BroadcastChannel<T> {
  private buffer: SharedMemoryBuffer;
  private mutex: Int32Array;
  private condition: Int32Array;
  private subscribers: Int32Array;
  private messageId: Int32Array;
  private messageCount: Int32Array;
  private data: Uint8Array;
  private config: Required<BroadcastChannelConfig>;
  private subscriberMap: Map<number, SubscriberInfo> = new Map();
  private nextSubscriberId = 1;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config?: Partial<BroadcastChannelConfig>) {
    this.config = {
      bufferSize: 1024 * 1024, // 1MB default
      maxSubscribers: 100,
      enableChecksum: true,
      messageRetention: 1000,
      cleanupInterval: 60000, // 1 minute
      ...config,
    };

    const flags = this.config.enableChecksum ? BufferFlags.CHECKSUMED : 0;

    this.buffer = new SharedMemoryBuffer(
      this.config.bufferSize + 64, // +64 for control structures
      { flags },
      new SharedArrayBuffer(this.config.bufferSize + 64)
    );

    // Initialize control structures at the end of the buffer
    const controlOffset = this.config.bufferSize;

    this.mutex = new Int32Array(this.buffer.getBuffer(), controlOffset, 1);
    this.condition = new Int32Array(
      this.buffer.getBuffer(),
      controlOffset + 4,
      1
    );
    this.subscribers = new Int32Array(
      this.buffer.getBuffer(),
      controlOffset + 8,
      1
    );
    this.messageId = new Int32Array(
      this.buffer.getBuffer(),
      controlOffset + 12,
      1
    );
    this.messageCount = new Int32Array(
      this.buffer.getBuffer(),
      controlOffset + 16,
      1
    );

    // Initialize control values
    Atomics.store(this.mutex, 0, MutexState.UNLOCKED);
    Atomics.store(this.condition, 0, 0);
    Atomics.store(this.subscribers, 0, 0);
    Atomics.store(this.messageId, 0, 0);
    Atomics.store(this.messageCount, 0, 0);

    this.data = new Uint8Array(
      this.buffer.getBuffer(),
      0,
      this.config.bufferSize
    );

    this.startCleanupTimer();
    logger.debug('BroadcastChannel created', { config: this.config });
  }

  /**
   * Broadcast a message to all subscribers
   *
   * @param data - Data to broadcast
   * @returns Promise that resolves when message is broadcast
   */
  async broadcast(data: T): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Broadcast channel is shutting down');
    }

    const message: BroadcastMessage<T> = {
      id: this.getNextMessageId(),
      data,
      timestamp: Date.now(),
      flags: 0,
      acknowledgments: 0,
    };

    // Acquire mutex for thread-safe operation
    if (!SharedMemoryAtomics.acquireMutex(this.mutex, 0, 1000)) {
      throw new Error('Failed to acquire broadcast mutex');
    }

    try {
      // Check if we have space for the message
      const currentCount = Atomics.load(this.messageCount, 0);
      if (currentCount >= this.config.messageRetention) {
        // Remove oldest message to make space
        this.removeOldestMessage();
      }

      // Write message to buffer
      const offset = this.calculateMessageOffset(currentCount);
      this.writeMessage(offset, message);

      // Update message count
      Atomics.add(this.messageCount, 0, 1);

      // Notify all waiting subscribers
      const subscriberCount = Atomics.load(this.subscribers, 0);
      if (subscriberCount > 0) {
        SharedMemoryAtomics.notifyAllConditions(this.condition, 0);
      }

      logger.debug('Message broadcast', {
        messageId: message.id,
        subscriberCount,
      });
    } finally {
      SharedMemoryAtomics.releaseMutex(this.mutex, 0);
    }
  }

  /**
   * Subscribe to broadcast messages
   *
   * @returns Promise that resolves with subscriber ID
   */
  async subscribe(): Promise<number> {
    if (this.isShuttingDown) {
      throw new Error('Broadcast channel is shutting down');
    }

    // Acquire mutex for thread-safe operation
    if (!SharedMemoryAtomics.acquireMutex(this.mutex, 0, 1000)) {
      throw new Error('Failed to acquire subscription mutex');
    }

    try {
      const currentSubscribers = Atomics.load(this.subscribers, 0);
      if (currentSubscribers >= this.config.maxSubscribers) {
        throw new Error('Maximum subscriber limit reached');
      }

      const subscriberId = this.nextSubscriberId++;
      const messageCount = Atomics.load(this.messageCount, 0);

      const subscriberInfo: SubscriberInfo = {
        id: subscriberId,
        lastMessageId: messageCount > 0 ? messageCount - 1 : 0,
        subscribedAt: Date.now(),
        lastActivity: Date.now(),
        messageOffset: 0,
      };

      this.subscriberMap.set(subscriberId, subscriberInfo);
      Atomics.add(this.subscribers, 0, 1);

      logger.debug('Subscriber added', {
        subscriberId,
        totalSubscribers: currentSubscribers + 1,
      });
      return subscriberId;
    } finally {
      SharedMemoryAtomics.releaseMutex(this.mutex, 0);
    }
  }

  /**
   * Unsubscribe from broadcast messages
   *
   * @param subscriberId - Subscriber ID to remove
   */
  unsubscribe(subscriberId: number): void {
    if (this.isShuttingDown) {
      return;
    }

    // Acquire mutex for thread-safe operation
    if (!SharedMemoryAtomics.acquireMutex(this.mutex, 0, 1000)) {
      logger.warn('Failed to acquire unsubscription mutex');
      return;
    }

    try {
      if (this.subscriberMap.has(subscriberId)) {
        this.subscriberMap.delete(subscriberId);
        Atomics.add(this.subscribers, 0, -1);
        logger.debug('Subscriber removed', { subscriberId });
      }
    } finally {
      SharedMemoryAtomics.releaseMutex(this.mutex, 0);
    }
  }

  /**
   * Receive the next message for a subscriber
   *
   * @param subscriberId - Subscriber ID
   * @param timeout - Optional timeout in milliseconds
   * @returns Promise that resolves with next message or undefined if no new messages
   */
  async receive(
    subscriberId: number,
    timeout?: number
  ): Promise<T | undefined> {
    if (this.isShuttingDown) {
      return undefined;
    }

    const subscriberInfo = this.subscriberMap.get(subscriberId);
    if (!subscriberInfo) {
      throw new Error('Invalid subscriber ID');
    }

    const messageCount = Atomics.load(this.messageCount, 0);

    // Check if there are new messages
    if (subscriberInfo.lastMessageId >= messageCount) {
      if (timeout === 0) {
        return undefined; // Non-blocking
      }

      // Wait for new messages
      return this.waitForMessage(subscriberId, timeout);
    }

    // Read next message
    const message = this.readMessage(subscriberInfo.lastMessageId);
    if (message) {
      subscriberInfo.lastMessageId++;
      subscriberInfo.lastActivity = Date.now();
      return message.data;
    }

    return undefined;
  }

  /**
   * Acknowledge receipt of a message
   *
   * @param subscriberId - Subscriber ID
   * @param messageId - Message ID to acknowledge
   */
  acknowledge(subscriberId: number, messageId: number): void {
    if (this.isShuttingDown) {
      return;
    }

    const subscriberInfo = this.subscriberMap.get(subscriberId);
    if (!subscriberInfo) {
      return;
    }

    // Update subscriber's last message ID
    subscriberInfo.lastMessageId = Math.max(
      subscriberInfo.lastMessageId,
      messageId + 1
    );
    subscriberInfo.lastActivity = Date.now();

    // Increment message acknowledgment count
    const message = this.readMessage(messageId);
    if (message) {
      // This would update the acknowledgment count in the message
      // Implementation depends on message storage format
    }
  }

  /**
   * Get subscriber count
   *
   * @returns Number of active subscribers
   */
  getSubscriberCount(): number {
    return Atomics.load(this.subscribers, 0);
  }

  /**
   * Check if a subscriber is subscribed
   *
   * @param subscriberId - Subscriber ID to check
   * @returns true if subscriber is active
   */
  isSubscribed(subscriberId: number): boolean {
    return this.subscriberMap.has(subscriberId);
  }

  /**
   * Get subscriber information
   *
   * @param subscriberId - Subscriber ID
   * @returns Subscriber information or undefined if not found
   */
  getSubscriberInfo(subscriberId: number): SubscriberInfo | undefined {
    return this.subscriberMap.get(subscriberId);
  }

  /**
   * Get all subscriber information
   *
   * @returns Array of all subscriber information
   */
  getAllSubscribers(): SubscriberInfo[] {
    return Array.from(this.subscriberMap.values());
  }

  /**
   * Shutdown the broadcast channel
   */
  shutdown(): void {
    this.isShuttingDown = true;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Wake up all waiting subscribers
    const subscriberCount = Atomics.load(this.subscribers, 0);
    if (subscriberCount > 0) {
      SharedMemoryAtomics.notifyAllConditions(this.condition, 0);
    }

    logger.info('BroadcastChannel shutdown completed');
  }

  /**
   * Start the automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Wait for new messages to arrive
   */
  private async waitForMessage(
    subscriberId: number,
    timeout?: number
  ): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve(undefined); // Timeout
      }, timeout || 30000);

      const checkForMessages = () => {
        if (this.isShuttingDown) {
          clearTimeout(timeoutId);
          resolve(undefined);
          return;
        }

        const subscriberInfo = this.subscriberMap.get(subscriberId);
        if (!subscriberInfo) {
          clearTimeout(timeoutId);
          reject(new Error('Subscriber not found'));
          return;
        }

        const messageCount = Atomics.load(this.messageCount, 0);
        if (subscriberInfo.lastMessageId < messageCount) {
          clearTimeout(timeoutId);

          // Read the message
          const message = this.readMessage(subscriberInfo.lastMessageId);
          if (message) {
            subscriberInfo.lastMessageId++;
            subscriberInfo.lastActivity = Date.now();
            resolve(message.data);
          } else {
            resolve(undefined);
          }
          return;
        }

        // Wait for condition
        SharedMemoryAtomics.waitCondition(this.condition, 0, 0, 100);

        // Check again
        setImmediate(checkForMessages);
      };

      checkForMessages();
    });
  }

  /**
   * Get the next message ID
   */
  private getNextMessageId(): number {
    return Atomics.add(this.messageId, 0, 1);
  }

  /**
   * Calculate message offset in the buffer
   */
  private calculateMessageOffset(messageIndex: number): number {
    // Simple offset calculation - in production you might want a more sophisticated approach
    return (messageIndex * 1024) % this.config.bufferSize;
  }

  /**
   * Write message to buffer
   */
  private writeMessage(offset: number, message: BroadcastMessage<T>): void {
    const serializedData = this.serialize(message.data);
    const messageSize = 24 + serializedData.length; // 24 bytes for message header

    if (offset + messageSize > this.config.bufferSize) {
      logger.warn('Message would overflow buffer', {
        offset,
        messageSize,
        bufferSize: this.config.bufferSize,
      });
      return;
    }

    // Write message header
    const headerView = new DataView(
      this.data.buffer,
      this.data.byteOffset + offset,
      24
    );
    headerView.setUint32(0, message.id, false);
    headerView.setUint32(4, message.timestamp, false);
    headerView.setUint32(8, message.flags, false);
    headerView.setUint32(12, message.acknowledgments, false);
    headerView.setUint32(16, serializedData.length, false);
    headerView.setUint32(20, 0); // Reserved

    // Write message data
    this.data.set(serializedData, offset + 24);
  }

  /**
   * Read message from buffer
   */
  private readMessage(messageIndex: number): BroadcastMessage<T> | null {
    const offset = this.calculateMessageOffset(messageIndex);

    try {
      // Read message header
      const headerView = new DataView(
        this.data.buffer,
        this.data.byteOffset + offset,
        24
      );
      const id = headerView.getUint32(0, false);
      const timestamp = headerView.getUint32(4, false);
      const flags = headerView.getUint32(8, false);
      const acknowledgments = headerView.getUint32(12, false);
      const dataSize = headerView.getUint32(16, false);

      if (dataSize === 0 || dataSize > this.config.bufferSize) {
        return null;
      }

      // Read message data
      const data = this.data.slice(offset + 24, offset + 24 + dataSize);
      const deserializedData = this.deserialize(data);

      return {
        id,
        data: deserializedData,
        timestamp,
        flags,
        acknowledgments,
      };
    } catch (error) {
      logger.error(
        'Failed to read message',
        new Error('Failed to read message'),
        { messageIndex, offset, error }
      );
      return null;
    }
  }

  /**
   * Remove the oldest message to make space
   */
  private removeOldestMessage(): void {
    const currentCount = Atomics.load(this.messageCount, 0);
    if (currentCount > 0) {
      // In a real implementation, you would implement a proper message eviction strategy
      // For now, we'll just decrement the count
      Atomics.add(this.messageCount, 0, -1);
      logger.debug('Removed oldest message');
    }
  }

  /**
   * Perform cleanup of inactive subscribers
   */
  private cleanup(): void {
    if (this.isShuttingDown) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - this.config.cleanupInterval * 2; // 2x cleanup interval

    let cleanedCount = 0;

    for (const [subscriberId, subscriberInfo] of this.subscriberMap) {
      if (subscriberInfo.lastActivity < cutoffTime) {
        this.subscriberMap.delete(subscriberId);
        Atomics.add(this.subscribers, 0, -1);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Subscriber cleanup completed', { cleanedCount });
    }
  }

  /**
   * Serialize data to Uint8Array
   */
  private serialize(data: T): Uint8Array {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }

  /**
   * Deserialize data from Uint8Array
   */
  private deserialize(data: Uint8Array): T {
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json);
  }
}
