// @ts-check
import { SharedChannel } from '../../../dist/index.js';

console.log('=== Shared Channels Example 4: Performance Testing ===\n');

// Example 4: Performance testing and benchmarking
async function performanceTesting() {
  console.log('1. Creating SharedChannel for performance testing:');

  const channel = new SharedChannel({
    bufferSize: 4 * 1024 * 1024, // 4MB
    maxMessages: 10000,
    enableBatching: true,
    compressionThreshold: 256, // 256 bytes
    enableChecksum: true,
    timeout: 120000, // 2 minutes
  });

  console.log('   Channel created for performance testing');

  // Performance test 1: Single message throughput
  console.log('\n2. Single message throughput test:');

  const singleMessageCount = 1000;
  const singleMessageData = 42;

  const singleSendStart = Date.now();
  for (let i = 0; i < singleMessageCount; i++) {
    await channel.send(singleMessageData);
  }
  const singleSendTime = Date.now() - singleSendStart;

  const singleReceiveStart = Date.now();
  for (let i = 0; i < singleMessageCount; i++) {
    await channel.receive();
  }
  const singleReceiveTime = Date.now() - singleReceiveStart;

  console.log(
    `   Single message send: ${singleMessageCount} messages in ${singleSendTime}ms`
  );
  console.log(
    `   Single message receive: ${singleMessageCount} messages in ${singleReceiveTime}ms`
  );
  console.log(
    `   Send throughput: ${(singleMessageCount / (singleSendTime / 1000)).toFixed(0)} msg/s`
  );
  console.log(
    `   Receive throughput: ${(singleMessageCount / (singleReceiveTime / 1000)).toFixed(0)} msg/s`
  );

  // Performance test 2: Batch operations
  console.log('\n3. Batch operations performance test:');

  const batchSizes = [10, 50, 100, 500];
  const batchData = Array.from({ length: 1000 }, (_, i) => i);

  for (const batchSize of batchSizes) {
    const batches = Math.ceil(batchData.length / batchSize);
    const batchMessages = [];

    for (let i = 0; i < batches; i++) {
      batchMessages.push(batchData.slice(i * batchSize, (i + 1) * batchSize));
    }

    // Test batch send
    const batchSendStart = Date.now();
    for (const batch of batchMessages) {
      await channel.sendBatch(batch);
    }
    const batchSendTime = Date.now() - batchSendStart;

    // Test batch receive
    const batchReceiveStart = Date.now();
    for (let i = 0; i < batches; i++) {
      await channel.receiveBatch(batchSize);
    }
    const batchReceiveTime = Date.now() - batchReceiveStart;

    console.log(`   Batch size ${batchSize}:`);
    console.log(
      `     Send: ${batches} batches in ${batchSendTime}ms (${(batchData.length / (batchSendTime / 1000)).toFixed(0)} msg/s)`
    );
    console.log(
      `     Receive: ${batches} batches in ${batchReceiveTime}ms (${(batchData.length / (batchReceiveTime / 1000)).toFixed(0)} msg/s)`
    );
  }

  // Performance test 3: Memory efficiency
  console.log('\n4. Memory efficiency test:');

  const memoryTestData = Array.from(
    { length: 100 },
    (_, i) => `Message ${i} with some content to test memory usage`
  );

  const memoryBefore = channel.getMemoryUsage();
  console.log(
    `   Memory before: ${memoryBefore.usedSize}/${memoryBefore.totalSize} bytes (${((memoryBefore.usedSize / memoryBefore.totalSize) * 100).toFixed(1)}%)`
  );

  // Send data
  for (const message of memoryTestData) {
    await channel.send(message);
  }

  const memoryAfterSend = channel.getMemoryUsage();
  console.log(
    `   Memory after send: ${memoryAfterSend.usedSize}/${memoryAfterSend.totalSize} bytes (${((memoryAfterSend.usedSize / memoryAfterSend.totalSize) * 100).toFixed(1)}%)`
  );

  // Receive data
  for (let i = 0; i < memoryTestData.length; i++) {
    await channel.receive();
  }

  const memoryAfterReceive = channel.getMemoryUsage();
  console.log(
    `   Memory after receive: ${memoryAfterReceive.usedSize}/${memoryAfterReceive.totalSize} bytes (${((memoryAfterReceive.usedSize / memoryAfterReceive.totalSize) * 100).toFixed(1)}%)`
  );

  // Performance test 4: Concurrent operations simulation
  console.log('\n5. Concurrent operations simulation:');

  const concurrentOperations = 100;
  const operationsPerThread = 50;

  const concurrentStart = Date.now();

  const promises = [];
  for (let i = 0; i < concurrentOperations; i++) {
    promises.push(async () => {
      for (let j = 0; j < operationsPerThread; j++) {
        await channel.send(i * operationsPerThread + j);
        await channel.receive();
      }
    });
  }

  // Execute operations concurrently
  await Promise.all(promises.map(p => p()));

  const concurrentTime = Date.now() - concurrentStart;
  const totalOperations = concurrentOperations * operationsPerThread * 2; // send + receive

  console.log(
    `   Concurrent operations: ${totalOperations} operations in ${concurrentTime}ms`
  );
  console.log(
    `   Throughput: ${(totalOperations / (concurrentTime / 1000)).toFixed(0)} ops/s`
  );

  // Performance test 5: Stress test
  console.log('\n6. Stress test:');

  const stressTestSize = 5000;
  const stressData = Array.from(
    { length: stressTestSize },
    (_, i) => `Stress message ${i}`
  );

  const stressStart = Date.now();

  // Send all data
  for (const message of stressData) {
    await channel.send(message);
  }

  // Receive all data
  for (let i = 0; i < stressData.length; i++) {
    await channel.receive();
  }

  const stressTime = Date.now() - stressStart;

  console.log(
    `   Stress test: ${stressTestSize * 2} operations in ${stressTime}ms`
  );
  console.log(
    `   Stress throughput: ${((stressTestSize * 2) / (stressTime / 1000)).toFixed(0)} ops/s`
  );

  // Final performance summary
  console.log('\n7. Performance summary:');

  const finalState = channel.getState();
  const finalMemoryUsage = channel.getMemoryUsage();

  console.log(
    `   Final channel state: ${finalState.length}/${finalState.capacity} messages`
  );
  console.log(
    `   Memory efficiency: ${((finalMemoryUsage.usedSize / finalMemoryUsage.totalSize) * 100).toFixed(1)}%`
  );
  console.log(
    `   Channel health: ${channel.isHealthy() ? 'HEALTHY' : 'UNHEALTHY'}`
  );

  // Shutdown
  console.log('\n8. Shutting down channel:');
  channel.shutdown();
  console.log('   Channel shutdown completed');
}

// Run the example
performanceTesting().catch(console.error);
