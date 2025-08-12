/* eslint-disable no-constant-condition */
// @ts-check
import { parentPort, workerData } from 'worker_threads';
import { SharedMemoryManager } from '../../../dist/index.js';

console.log(`Worker ${workerData.workerId || 'main'} starting...`);

// Create shared memory manager in worker
const manager = new SharedMemoryManager({
  enableMonitoring: false, // Disable monitoring in workers for performance
});

try {
  // Get shared buffers
  const inputBuffer = manager.getBuffer(workerData.inputBufferName);
  const outputBuffer = manager.getBuffer(workerData.outputBufferName);
  const controlBuffer = manager.getBuffer(workerData.controlBufferName);

  if (!inputBuffer || !outputBuffer || !controlBuffer) {
    throw new Error('Failed to get shared buffers');
  }

  console.log(`Worker ${workerData.workerId || 'main'} got shared buffers`);

  // Wait for control signal
  let controlData;
  do {
    controlData = manager.copyFromBuffer(controlBuffer, 0, 2);
    if (controlData[0] === 1) {
      // Data available
      break;
    }
    // Small delay to avoid busy waiting
    await new Promise(resolve => setTimeout(resolve, 10));
  } while (true);

  const dataLength = controlData[1];
  console.log(
    `Worker ${workerData.workerId || 'main'} received control signal, data length: ${dataLength}`
  );

  // Read input data
  const inputData = manager.copyFromBuffer(inputBuffer, 0, dataLength);
  const inputText = new TextDecoder().decode(inputData);
  console.log(`Worker ${workerData.workerId || 'main'} read: "${inputText}"`);

  // Process data (simulate work)
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time

  const processedText = `Processed by worker ${workerData.workerId || 'main'}: ${inputText.toUpperCase()}`;
  const outputData = new TextEncoder().encode(processedText);

  // Write output data
  manager.copyToBuffer(outputData, outputBuffer, 0);
  console.log(`Worker ${workerData.workerId || 'main'} wrote processed data`);

  // Send completion signal
  const completionSignal = new Uint8Array([2, 0]); // Signal: processing complete
  manager.copyToBuffer(completionSignal, controlBuffer, 0);
  console.log(`Worker ${workerData.workerId || 'main'} sent completion signal`);

  // Notify main thread
  // @ts-expect-error - TODO
  parentPort.postMessage(
    `Worker ${workerData.workerId || 'main'} completed processing`
  );
} catch (error) {
  console.error(
    `Worker ${workerData.workerId || 'main'} error:`,
    error.message
  );
  // @ts-expect-error - TODO
  parentPort.postMessage(
    `Worker ${workerData.workerId || 'main'} error: ${error.message}`
  );
} finally {
  // Cleanup
  await manager.shutdown();
  console.log(`Worker ${workerData.workerId || 'main'} shutdown completed`);
}
