/* eslint-disable no-case-declarations */
import { parentPort, workerData } from 'worker_threads';

// Worker thread implementation
if (parentPort) {
  parentPort?.on('message', async (message: AnyValue) => {
    try {
      switch (message.type) {
        case 'execute':
          // Request the main thread to execute the function by ID
          // This avoids serialization issues while still using worker threads
          parentPort?.postMessage({
            id: message.id,
            type: 'execute_function',
            functionId: message.functionId,
            args: message.args || [],
            workerId: workerData.workerId,
          });
          break;

        case 'heartbeat':
          parentPort?.postMessage({
            id: message.id,
            success: true,
            workerId: workerData.workerId,
          });
          break;

        case 'shutdown':
          // Send confirmation before exiting
          parentPort?.postMessage({
            id: message.id,
            success: true,
            workerId: workerData.workerId,
          });
          // Exit after a small delay to ensure message is sent
          setTimeout(() => {
            process.exit(0);
          }, 100);
          break;

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      parentPort?.postMessage({
        id: message.id,
        success: false,
        error: (error as Error).message,
        workerId: workerData.workerId,
      });
    }
  });
}
