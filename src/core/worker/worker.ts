/* eslint-disable no-case-declarations */
import { parentPort, workerData } from 'worker_threads';

// Worker thread implementation
parentPort?.on('message', async (message: AnyValue) => {
  try {
    switch (message.type) {
      case 'execute':
        // Create a function from the serialized code
        const functionBody = message.fn;

        // Create a completely isolated execution environment
        const isolatedFunction = new Function(`
          return (async function() {
            ${functionBody}
          })();
        `);

        // Execute the function in a try-catch to handle any errors
        let result;
        try {
          result = await isolatedFunction();
        } catch (executionError) {
          throw new Error(
            `Function execution failed: ${(executionError as Error).message}`
          );
        }

        parentPort?.postMessage({
          id: message.id,
          success: true,
          result,
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
        process.exit(0);
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
