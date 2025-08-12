// @ts-check
import { SharedMemoryManager } from '../../../dist/index.js';

console.log(
  '=== Shared Memory Example 3: Multiple Buffers and Worker Association ===\n'
);

// Example 3: Managing multiple buffers with worker thread associations
async function multipleBuffersAndWorkers() {
  console.log('1. Creating SharedMemoryManager:');

  const manager = new SharedMemoryManager({
    bufferSize: 512 * 1024, // 512KB
    maxBuffers: 5,
    cleanupInterval: 15000, // 15 seconds
    enableMonitoring: true,
  });

  console.log('   Manager created with 5 buffer limit');

  // Create multiple buffers for different purposes
  console.log('\n2. Creating multiple buffers:');

  const buffers = {
    'input-queue': manager.createBuffer(1024, 'input-queue'),
    'output-queue': manager.createBuffer(1024, 'output-queue'),
    'data-cache': manager.createBuffer(2048, 'data-cache'),
    'config-store': manager.createBuffer(512, 'config-store'),
    'temp-buffer': manager.createBuffer(1024, 'temp-buffer'),
  };

  console.log('   Created 5 buffers for different purposes:');
  Object.keys(buffers).forEach(name => {
    console.log(`     - ${name}: ${buffers[name].byteLength} bytes`);
  });

  // Simulate worker thread associations
  console.log('\n3. Simulating worker thread associations:');

  const workerIds = [1001, 1002, 1003];

  // Associate workers with buffers
  workerIds.forEach(workerId => {
    manager.associateWorker('input-queue', workerId);
    manager.associateWorker('output-queue', workerId);
    console.log(`   Worker ${workerId} associated with input/output queues`);
  });

  // Associate specific workers with specific buffers
  manager.associateWorker('data-cache', 1001);
  manager.associateWorker('config-store', 1002);
  manager.associateWorker('temp-buffer', 1003);

  console.log('   Specific workers associated with specific buffers');

  // List all buffers with metadata
  console.log('\n4. Buffer metadata for all buffers:');
  const bufferNames = manager.listBuffers();

  bufferNames.forEach(name => {
    const metadata = manager.getBufferMetadata(name);
    if (metadata) {
      console.log(`   ${name}:`);
      console.log(`     Size: ${metadata.size} bytes`);
      console.log(`     Workers: ${Array.from(metadata.workerIds).join(', ')}`);
      console.log(`     Access count: ${metadata.accessCount}`);
      console.log(
        `     Created: ${new Date(metadata.createdAt).toLocaleTimeString()}`
      );
    }
  });

  // Simulate buffer access by workers
  console.log('\n5. Simulating buffer access by workers:');

  // Worker 1001 accesses input-queue
  const inputBuffer = manager.getBuffer('input-queue', 1001);
  if (inputBuffer) {
    const data = new TextEncoder().encode('Task data from worker 1001');
    manager.copyToBuffer(data, inputBuffer, 0);
    console.log('   Worker 1001 wrote to input-queue');
  }

  // Worker 1002 accesses output-queue
  const outputBuffer = manager.getBuffer('output-queue', 1002);
  if (outputBuffer) {
    const data = new TextEncoder().encode('Result data from worker 1002');
    manager.copyToBuffer(data, outputBuffer, 0);
    console.log('   Worker 1002 wrote to output-queue');
  }

  // Worker 1003 accesses data-cache
  const cacheBuffer = manager.getBuffer('data-cache', 1003);
  if (cacheBuffer) {
    const data = new TextEncoder().encode('Cached data from worker 1003');
    manager.copyToBuffer(data, cacheBuffer, 0);
    console.log('   Worker 1003 wrote to data-cache');
  }

  // Check memory usage after access
  console.log('\n6. Memory usage after worker access:');
  const usage = manager.getMemoryUsage();
  console.log(`   Total allocated: ${usage.total} bytes`);
  console.log(`   Used memory: ${usage.used} bytes`);
  console.log(`   Active buffers: ${usage.buffers}`);
  console.log(`   Peak usage: ${usage.peak} bytes`);

  // Test buffer disassociation
  console.log('\n7. Testing worker disassociation:');

  manager.disassociateWorker('input-queue', 1001);
  console.log('   Worker 1001 disassociated from input-queue');

  const updatedMetadata = manager.getBufferMetadata('input-queue');
  if (updatedMetadata) {
    console.log(
      `   input-queue workers: ${Array.from(updatedMetadata.workerIds).join(', ')}`
    );
  }

  // Test partial buffer release
  console.log('\n8. Testing partial buffer release:');

  const released1 = manager.releaseBuffer('temp-buffer', 1003);
  console.log(`   temp-buffer released by worker 1003: ${released1}`);

  const released2 = manager.releaseBuffer('temp-buffer', 1002);
  console.log(`   temp-buffer released by worker 1002: ${released2}`);

  // Check which buffers remain
  console.log('\n9. Remaining buffers:');
  const remainingBuffers = manager.listBuffers();
  console.log(`   Active buffers: ${remainingBuffers.join(', ')}`);

  // Test cleanup
  console.log('\n10. Testing cleanup:');
  manager.cleanup();
  console.log('   Cleanup completed');

  // Final memory usage
  console.log('\n11. Final memory usage:');
  const finalUsage = manager.getMemoryUsage();
  console.log(`   Total allocated: ${finalUsage.total} bytes`);
  console.log(`   Active buffers: ${finalUsage.buffers}`);

  // Shutdown
  await manager.shutdown();
  console.log('\n   Manager shutdown completed');
}

// Run the example
multipleBuffersAndWorkers().catch(console.error);
