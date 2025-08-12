// @ts-check
import { SharedMemoryManager } from '../../../dist/index.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Shared Memory Example 5: Worker Thread Integration ===\n');

// Example 5: Integration with worker threads for real concurrent processing
async function workerThreadIntegration() {
  console.log('1. Creating SharedMemoryManager for worker integration:');

  const manager = new SharedMemoryManager({
    bufferSize: 1024 * 1024, // 1MB
    maxBuffers: 10,
    cleanupInterval: 30000, // 30 seconds
    enableMonitoring: true,
  });

  console.log('   Manager created for worker thread integration');

  // Create shared buffers for communication
  console.log('\n2. Creating shared buffers for worker communication:');

  const inputBuffer = manager.createBuffer(1024, 'worker-input');
  const outputBuffer = manager.createBuffer(1024, 'worker-output');
  const controlBuffer = manager.createBuffer(256, 'worker-control');

  console.log('   Created input, output, and control buffers');

  // Create worker thread
  console.log('\n3. Creating worker thread:');

  const worker = new Worker(join(__dirname, 'worker.js'), {
    workerData: {
      inputBufferName: 'worker-input',
      outputBufferName: 'worker-output',
      controlBufferName: 'worker-control',
    },
  });

  console.log('   Worker thread created');

  // Set up worker message handling
  worker.on('message', message => {
    console.log(`   Worker message: ${message}`);
  });

  worker.on('error', error => {
    console.error(`   Worker error: ${error.message}`);
  });

  worker.on('exit', code => {
    console.log(`   Worker exited with code ${code}`);
  });

  // Send data to worker via shared memory
  console.log('\n4. Sending data to worker via shared memory:');

  const inputData = new TextEncoder().encode(
    'Hello from main thread! This is shared memory data.'
  );
  manager.copyToBuffer(inputData, inputBuffer, 0);

  // Send control signal to worker
  const controlData = new Uint8Array([1, inputData.length]); // Signal: data available + length
  manager.copyToBuffer(controlData, controlBuffer, 0);

  console.log(`   Sent ${inputData.length} bytes to worker via shared memory`);
  console.log(`   Control signal sent: data available`);

  // Wait for worker to process
  console.log('\n5. Waiting for worker to process data...');

  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      const controlData = manager.copyFromBuffer(controlBuffer, 0, 2);
      if (controlData[0] === 2) {
        // Signal: processing complete
        clearInterval(checkInterval);
        // @ts-expect-error - TODO
        resolve();
      }
    }, 100);
  });

  console.log('   Worker processing completed');

  // Read results from worker
  console.log('\n6. Reading results from worker:');

  const outputData = manager.copyFromBuffer(outputBuffer, 0, 1024);
  const outputText = new TextDecoder().decode(outputData).replace(/\0/g, '');
  console.log(`   Worker output: "${outputText}"`);

  // Check memory usage
  console.log('\n7. Memory usage after worker processing:');
  const usage = manager.getMemoryUsage();
  console.log(`   Total allocated: ${usage.total} bytes`);
  console.log(`   Active buffers: ${usage.buffers}`);
  console.log(`   Peak usage: ${usage.peak} bytes`);

  // Test multiple workers
  console.log('\n8. Testing multiple workers:');

  const workers = [];
  const workerCount = 3;

  for (let i = 0; i < workerCount; i++) {
    const workerBuffer = manager.createBuffer(512, `worker-${i}-buffer`);
    const workerData = new TextEncoder().encode(`Data for worker ${i}`);
    manager.copyToBuffer(workerData, workerBuffer, 0);

    const worker = new Worker(join(__dirname, 'worker.js'), {
      workerData: {
        inputBufferName: `worker-${i}-buffer`,
        outputBufferName: `worker-${i}-output`,
        controlBufferName: `worker-${i}-control`,
        workerId: i,
      },
    });

    workers.push(worker);
    console.log(`   Created worker ${i}`);
  }

  // Wait for all workers to complete
  console.log('\n9. Waiting for all workers to complete...');

  await Promise.all(
    workers.map(worker => {
      return new Promise(resolve => {
        worker.on('exit', resolve);
      });
    })
  );

  console.log('   All workers completed');

  // Final memory usage
  console.log('\n10. Final memory usage:');
  const finalUsage = manager.getMemoryUsage();
  console.log(`   Total allocated: ${finalUsage.total} bytes`);
  console.log(`   Active buffers: ${finalUsage.buffers}`);

  // Cleanup
  console.log('\n11. Cleanup:');
  workers.forEach(worker => worker.terminate());
  manager.cleanup();
  console.log('   Workers terminated and cleanup completed');

  // Shutdown
  await manager.shutdown();
  console.log('\n   Manager shutdown completed');
}

// Run the example
workerThreadIntegration().catch(console.error);
