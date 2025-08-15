// @ts-check
import { SharedMemoryManager } from '../../../dist/index.js';

console.log('=== Shared Memory Example 4: Data Transfer and Performance ===\n');

// Example 4: Performance testing and data transfer patterns
async function dataTransferAndPerformance() {
  console.log('1. Creating SharedMemoryManager for performance testing:');

  const manager = new SharedMemoryManager({
    bufferSize: 2 * 1024 * 1024, // 2MB
    maxBuffers: 20,
    cleanupInterval: 60000, // 1 minute
    enableMonitoring: true,
  });

  console.log('   Manager created for performance testing');

  // Test 1: Large data transfer
  console.log('\n2. Testing large data transfer:');

  const largeData = new Uint8Array(1024 * 1024); // 1MB
  for (let i = 0; i < largeData.length; i++) {
    largeData[i] = i % 256; // Fill with pattern
  }

  const largeBuffer = manager.createBuffer(largeData.length, 'large-data');

  const startTime = Date.now();
  const bytesCopied = manager.copyToBuffer(largeData, largeBuffer, 0);
  const copyTime = Date.now() - startTime;

  console.log(`   Copied ${bytesCopied} bytes in ${copyTime}ms`);
  console.log(
    `   Transfer rate: ${(bytesCopied / 1024 / 1024 / (copyTime / 1000)).toFixed(2)} MB/s`
  );

  // Test 2: Multiple small transfers
  console.log('\n3. Testing multiple small transfers:');

  const smallBuffer = manager.createBuffer(1024, 'small-data');
  const smallData = new Uint8Array(100);

  const smallStartTime = Date.now();
  let totalSmallBytes = 0;

  for (let i = 0; i < 100; i++) {
    smallData.fill(i);
    totalSmallBytes += manager.copyToBuffer(smallData, smallBuffer, 0);
  }

  const smallTime = Date.now() - smallStartTime;
  console.log(
    `   Completed ${100} small transfers (${totalSmallBytes} total bytes) in ${smallTime}ms`
  );
  console.log(
    `   Average transfer rate: ${(totalSmallBytes / 1024 / (smallTime / 1000)).toFixed(2)} KB/s`
  );

  // Test 3: Concurrent buffer operations
  console.log('\n4. Testing concurrent buffer operations:');

  const concurrentBuffers = [];
  const concurrentStartTime = Date.now();

  // Create multiple buffers concurrently
  const createPromises = Array.from({ length: 10 }, (_, i) => {
    return new Promise(resolve => {
      setTimeout(() => {
        const buffer = manager.createBuffer(1024, `concurrent-${i}`);
        concurrentBuffers.push(buffer);
        resolve(buffer);
      }, Math.random() * 10); // Random delay
    });
  });

  await Promise.all(createPromises);
  const concurrentTime = Date.now() - concurrentStartTime;

  console.log(
    `   Created ${concurrentBuffers.length} buffers concurrently in ${concurrentTime}ms`
  );

  // Test 4: Data integrity verification
  console.log('\n5. Testing data integrity:');

  const testData = new TextEncoder().encode(
    'Hello, Shared Memory! This is a test of data integrity.'
  );
  const integrityBuffer = manager.createBuffer(
    testData.length,
    'integrity-test'
  );

  // Write data
  manager.copyToBuffer(testData, integrityBuffer, 0);
  console.log(`   Wrote test data: "${new TextDecoder().decode(testData)}"`);

  // Read data back
  const readData = manager.copyFromBuffer(integrityBuffer, 0, testData.length);
  const readText = new TextDecoder().decode(readData);
  console.log(`   Read data back: "${readText}"`);

  // Verify integrity
  const integrity = testData.every((byte, index) => byte === readData[index]);
  console.log(`   Data integrity verified: ${integrity ? 'PASS' : 'FAIL'}`);

  // Test 5: Memory usage patterns
  console.log('\n6. Memory usage patterns:');

  const initialUsage = manager.getMemoryUsage();
  console.log(`   Initial memory usage: ${initialUsage.total} bytes`);

  // Create more buffers
  for (let i = 0; i < 5; i++) {
    manager.createBuffer(512, `pattern-${i}`);
  }

  const midUsage = manager.getMemoryUsage();
  console.log(`   Mid-test memory usage: ${midUsage.total} bytes`);
  console.log(`   Memory growth: ${midUsage.total - initialUsage.total} bytes`);

  // Release some buffers
  for (let i = 0; i < 3; i++) {
    manager.releaseBuffer(`pattern-${i}`);
  }

  const finalUsage = manager.getMemoryUsage();
  console.log(`   Final memory usage: ${finalUsage.total} bytes`);
  console.log(
    `   Memory reclaimed: ${midUsage.total - finalUsage.total} bytes`
  );

  // Test 6: Buffer metadata tracking
  console.log('\n7. Buffer metadata tracking:');

  const allBuffers = manager.listBuffers();
  console.log(`   Total buffers: ${allBuffers.length}`);

  allBuffers.forEach(name => {
    const metadata = manager.getBufferMetadata(name);
    if (metadata) {
      const age = Date.now() - metadata.createdAt;
      console.log(
        `   ${name}: ${metadata.size} bytes, age: ${age}ms, accesses: ${metadata.accessCount}`
      );
    }
  });

  // Performance summary
  console.log('\n8. Performance summary:');
  const totalUsage = manager.getMemoryUsage();
  console.log(`   Total memory allocated: ${totalUsage.total} bytes`);
  console.log(`   Peak memory usage: ${totalUsage.peak} bytes`);
  console.log(`   Active buffers: ${totalUsage.buffers}`);
  console.log(`   Memory overhead: ${totalUsage.overhead} bytes`);

  // Cleanup
  console.log('\n9. Cleanup:');
  manager.cleanup();
  console.log('   Cleanup completed');

  // Shutdown
  await manager.shutdown();
  console.log('\n   Manager shutdown completed');
}

// Run the example
dataTransferAndPerformance().catch(console.error);
