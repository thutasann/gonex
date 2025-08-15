/* eslint-disable @typescript-eslint/ban-ts-comment */
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
      // Pass the actual SharedArrayBuffer instances
      inputBuffer: inputBuffer,
      outputBuffer: outputBuffer,
      controlBuffer: controlBuffer,
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
      try {
        const controlData = manager.copyFromBuffer(controlBuffer, 0, 2);
        if (controlData[0] === 2) {
          // Signal: processing complete
          clearInterval(checkInterval);
          // @ts-ignore
          resolve();
        }
      } catch (error) {
        console.error('Error checking control buffer:', error.message);
        clearInterval(checkInterval);
        // @ts-ignore
        resolve();
      }
    }, 100);

    // Timeout after 10 seconds to prevent hanging
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('   Timeout waiting for worker, continuing...');
      // @ts-ignore
      resolve();
    }, 10000);
  });

  console.log('   Worker processing completed');

  // Read results from worker
  console.log('\n6. Reading results from worker:');

  try {
    const outputData = manager.copyFromBuffer(outputBuffer, 0, 1024);
    const outputText = new TextDecoder().decode(outputData).replace(/\0/g, '');
    console.log(`   Worker output: "${outputText}"`);
  } catch (error) {
    console.log(`   Could not read output: ${error.message}`);
  }

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
        // Pass the actual buffer for this worker
        inputBuffer: workerBuffer,
        outputBuffer: null, // This worker doesn't need output
        controlBuffer: null, // This worker doesn't need control
        workerId: i,
        isSimpleWorker: true, // Flag to indicate this is a simple worker
      },
    });

    workers.push(worker);
    console.log(`   Created worker ${i}`);
  }

  // Wait for all workers to complete with timeout
  console.log('\n9. Waiting for all workers to complete...');

  await Promise.all(
    workers.map(worker => {
      return new Promise(resolve => {
        const timeout = setTimeout(() => {
          console.log(`   Worker timeout, forcing termination`);
          worker.terminate();
          // @ts-ignore
          resolve();
        }, 5000); // 5 second timeout

        worker.on('exit', code => {
          clearTimeout(timeout);
          console.log(`   Worker exited with code ${code}`);
          // @ts-ignore
          resolve();
        });

        worker.on('error', error => {
          clearTimeout(timeout);
          console.log(`   Worker error: ${error.message}`);
          // @ts-ignore
          resolve();
        });
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

  // Force terminate any remaining workers
  workers.forEach(worker => {
    try {
      worker.terminate();
    } catch (error) {
      console.log(`   Worker termination error: ${error.message}`);
    }
  });

  // Also terminate the main worker
  try {
    worker.terminate();
  } catch (error) {
    console.log(`   Main worker termination error: ${error.message}`);
  }

  manager.cleanup();
  console.log('   Workers terminated and cleanup completed');

  // Shutdown
  console.log('\n12. Shutting down manager...');
  await manager.shutdown();
  console.log('   Manager shutdown completed');
}

// Run the example with proper error handling and exit
async function main() {
  try {
    await workerThreadIntegration();
    console.log('\n=== Example completed successfully ===');
  } catch (error) {
    console.error('\n=== Example failed ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Force exit after a short delay to ensure cleanup
    setTimeout(() => {
      console.log('Forcing exit...');
      process.exit(0);
    }, 1000);
  }
}

main();
