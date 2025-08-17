// @ts-check
import { SharedChannel } from '../../../dist/index.js';

console.log('=== Shared Channels Example 1: Basic Operations ===\n');

// Example 1: Basic shared channel operations
async function basicChannelOperations() {
  console.log('1. Creating SharedChannel:');

  const channel = new SharedChannel({
    bufferSize: 1024 * 1024, // 1MB
    maxMessages: 100,
    enableBatching: true,
    compressionThreshold: 1024, // 1KB
    enableChecksum: true,
    timeout: 30000, // 30 seconds
  });

  console.log('   Channel created with batching and checksum enabled');

  // Get initial channel state
  console.log('\n2. Initial channel state:');
  const initialState = channel.getState();
  console.log(`   Length: ${initialState.length}`);
  console.log(`   Capacity: ${initialState.capacity}`);
  console.log(`   Is full: ${initialState.isFull}`);
  console.log(`   Is empty: ${initialState.isEmpty}`);
  console.log(`   Waiting senders: ${initialState.waitingSenders}`);
  console.log(`   Waiting receivers: ${initialState.waitingReceivers}`);

  // Send messages
  console.log('\n3. Sending messages:');

  const messages = [
    'Hello from sender!',
    'This is message number 2',
    'Testing the shared channel',
    'Message with special chars: !@#$%^&*()',
    'Final message in the batch',
  ];

  for (let i = 0; i < messages.length; i++) {
    await channel.send(messages[i]);
    console.log(`   Sent message ${i + 1}: "${messages[i]}"`);
  }

  // Check channel state after sending
  console.log('\n4. Channel state after sending:');
  const afterSendState = channel.getState();
  console.log(`   Length: ${afterSendState.length}`);
  console.log(`   Is full: ${afterSendState.isFull}`);
  console.log(`   Is empty: ${afterSendState.isEmpty}`);

  // Receive messages
  console.log('\n5. Receiving messages:');

  const receivedMessages = [];
  for (let i = 0; i < messages.length; i++) {
    const message = await channel.receive();
    receivedMessages.push(message);
    console.log(`   Received message ${i + 1}: "${message}"`);
  }

  // Verify all messages were received correctly
  console.log('\n6. Message verification:');
  const allCorrect = messages.every(
    (msg, index) => msg === receivedMessages[index]
  );
  console.log(
    `   All messages received correctly: ${allCorrect ? 'YES' : 'NO'}`
  );

  // Check final channel state
  console.log('\n7. Final channel state:');
  const finalState = channel.getState();
  console.log(`   Length: ${finalState.length}`);
  console.log(`   Is empty: ${finalState.isEmpty}`);

  // Test channel health
  console.log('\n8. Channel health check:');
  const isHealthy = channel.isHealthy();
  console.log(`   Channel is healthy: ${isHealthy ? 'YES' : 'NO'}`);

  // Get memory usage
  console.log('\n9. Memory usage:');
  const memoryUsage = channel.getMemoryUsage();
  console.log(`   Total size: ${memoryUsage.totalSize} bytes`);
  console.log(`   Data size: ${memoryUsage.dataSize} bytes`);
  console.log(`   Control size: ${memoryUsage.controlSize} bytes`);
  console.log(`   Used size: ${memoryUsage.usedSize} bytes`);
  console.log(`   Free size: ${memoryUsage.freeSize} bytes`);

  // Shutdown channel
  console.log('\n10. Shutting down channel:');
  channel.shutdown();
  console.log('   Channel shutdown completed');
}

// Run the example
basicChannelOperations().catch(console.error);
