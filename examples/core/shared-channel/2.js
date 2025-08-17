// @ts-check
import { SharedChannel } from '../../../dist/index.js';

console.log('=== Shared Channels Example 2: Batch Operations ===\n');

// Example 2: Batch send and receive operations
async function batchOperations() {
  console.log('1. Creating SharedChannel with batch support:');

  const channel = new SharedChannel({
    bufferSize: 2 * 1024 * 1024, // 2MB
    maxMessages: 500,
    enableBatching: true,
    compressionThreshold: 512, // 512 bytes
    enableChecksum: true,
    timeout: 60000, // 60 seconds
  });
  console.log('   Channel created with enhanced batch support');

  // Generate test data
  console.log('\n2. Generating test data:');
  const testData = Array.from({ length: 100 }, (_, i) => i * 10);
  console.log(
    `   Generated ${testData.length} numbers: ${testData.slice(0, 5).join(', ')}...`
  );

  // Send data in batches
  console.log('\n3. Sending data in batches:');

  const batchSizes = [10, 25, 50, 15]; // Different batch sizes
  let dataIndex = 0;

  for (let i = 0; i < batchSizes.length; i++) {
    const batchSize = batchSizes[i];
    const batch = testData.slice(dataIndex, dataIndex + batchSize);

    if (batch.length > 0) {
      console.log(`   Sending batch ${i + 1}: ${batch.length} items`);
      await channel.sendBatch(batch);
      console.log(`   ✓ Batch ${i + 1} sent successfully`);

      dataIndex += batchSize;
    }
  }

  // Check channel state
  console.log('\n4. Channel state after batch sending:');
  const state = channel.getState();
  console.log(`   Messages in channel: ${state.length}`);
  console.log(`   Channel capacity: ${state.capacity}`);
  console.log(
    `   Utilization: ${((state.length / state.capacity) * 100).toFixed(1)}%`
  );

  // Receive data in batches
  console.log('\n5. Receiving data in batches:');

  const receivedBatches = [];
  let totalReceived = 0;

  while (totalReceived < testData.length) {
    const batchSize = Math.min(20, testData.length - totalReceived);
    console.log(`   Receiving batch of ${batchSize} items...`);

    const batch = await channel.receiveBatch(batchSize);
    receivedBatches.push(batch);
    totalReceived += batch.length;

    console.log(
      `   ✓ Received batch: ${batch.length} items (Total: ${totalReceived}/${testData.length})`
    );
  }

  // Flatten received batches
  const receivedData = receivedBatches.flat();

  // Verify data integrity
  console.log('\n6. Data integrity verification:');
  const allCorrect = testData.every(
    (value, index) => value === receivedData[index]
  );
  console.log(`   All data received correctly: ${allCorrect ? 'YES' : 'NO'}`);

  if (allCorrect) {
    console.log(`   Total items processed: ${receivedData.length}`);
    console.log(
      `   Sample received data: ${receivedData.slice(0, 10).join(', ')}...`
    );
  } else {
    console.log('   ❌ Data mismatch detected!');

    // Find first mismatch
    const firstMismatch = testData.findIndex(
      (value, index) => value !== receivedData[index]
    );
    if (firstMismatch !== -1) {
      console.log(
        `   First mismatch at index ${firstMismatch}: expected ${testData[firstMismatch]}, got ${receivedData[firstMismatch]}`
      );
    }
  }

  // Performance metrics
  console.log('\n7. Performance metrics:');
  const finalState = channel.getState();
  const memoryUsage = channel.getMemoryUsage();

  console.log(`   Final channel length: ${finalState.length}`);
  console.log(
    `   Memory efficiency: ${((memoryUsage.usedSize / memoryUsage.totalSize) * 100).toFixed(1)}%`
  );
  console.log(
    `   Batch processing: ${receivedBatches.length} batches processed`
  );

  // Test non-blocking operations
  console.log('\n8. Testing non-blocking operations:');

  // Try to send when channel is full
  try {
    const result = channel.trySend(999);
    console.log(`   trySend result: ${result}`);
  } catch (error) {
    console.log(`   trySend error: ${error.message}`);
  }

  // Try to receive when channel is empty
  try {
    const result = channel.tryReceive();
    console.log(
      `   tryReceive result: ${result === undefined ? 'undefined' : result}`
    );
  } catch (error) {
    console.log(`   tryReceive error: ${error.message}`);
  }

  // Shutdown
  console.log('\n9. Shutting down channel:');
  channel.shutdown();
  console.log('   Channel shutdown completed');
}

// Run the example
batchOperations().catch(console.error);
