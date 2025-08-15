// @ts-check
import { SharedMemoryManager } from '../../../dist/index.js';

console.log('=== Shared Memory Example 1: Basic Buffer Management ===\n');

// Example 1: Basic shared memory buffer creation and management
async function basicBufferManagement() {
  console.log('1. Creating SharedMemoryManager:');

  const manager = new SharedMemoryManager({
    bufferSize: 1024 * 1024, // 1MB
    maxBuffers: 10,
    cleanupInterval: 30000, // 30 seconds
    enableMonitoring: true,
  });

  console.log('   Manager created with monitoring enabled');

  // Create a buffer
  console.log('\n2. Creating shared memory buffer:');
  const buffer = manager.createBuffer(1024, 'example-buffer');
  console.log(`   Buffer created: ${buffer.byteLength} bytes`);
  console.log(`   Buffer name: example-buffer`);

  // List all buffers
  console.log('\n3. Listing all buffers:');
  const buffers = manager.listBuffers();
  console.log(`   Available buffers: ${buffers.join(', ')}`);

  // Get memory usage
  console.log('\n4. Memory usage statistics:');
  const usage = manager.getMemoryUsage();
  console.log(`   Total allocated: ${usage.total} bytes`);
  console.log(`   Used memory: ${usage.used} bytes`);
  console.log(`   Active buffers: ${usage.buffers}`);
  console.log(`   Memory overhead: ${usage.overhead} bytes`);
  console.log(`   Peak usage: ${usage.peak} bytes`);

  // Copy data to buffer
  console.log('\n5. Copying data to buffer:');
  const data = new TextEncoder().encode('Hello, Shared Memory!');
  const bytesCopied = manager.copyToBuffer(data, buffer, 0);
  console.log(`   Copied ${bytesCopied} bytes to buffer`);

  // Copy data from buffer
  console.log('\n6. Reading data from buffer:');
  const readData = manager.copyFromBuffer(buffer, 0, bytesCopied);
  const text = new TextDecoder().decode(readData);
  console.log(`   Read from buffer: "${text}"`);

  // Get buffer metadata
  console.log('\n7. Buffer metadata:');
  const metadata = manager.getBufferMetadata('example-buffer');
  if (metadata) {
    console.log(`   Buffer ID: ${metadata.id}`);
    console.log(`   Size: ${metadata.size} bytes`);
    console.log(`   Created: ${new Date(metadata.createdAt).toISOString()}`);
    console.log(
      `   Last accessed: ${new Date(metadata.lastAccessed).toISOString()}`
    );
    console.log(`   Access count: ${metadata.accessCount}`);
    console.log(`   Worker associations: ${metadata.workerIds.size}`);
  }

  // Cleanup
  console.log('\n8. Cleanup:');
  const released = manager.releaseBuffer('example-buffer');
  console.log(`   Buffer released: ${released}`);

  // Final memory usage
  console.log('\n9. Final memory usage:');
  const finalUsage = manager.getMemoryUsage();
  console.log(`   Total allocated: ${finalUsage.total} bytes`);
  console.log(`   Active buffers: ${finalUsage.buffers}`);

  // Shutdown
  await manager.shutdown();
  console.log('\n   Manager shutdown completed');
}

// Run the example
basicBufferManagement().catch(console.error);
