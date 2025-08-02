/* eslint-disable no-case-declarations */
import { parentPort, workerData } from 'worker_threads';

// Worker thread implementation
parentPort?.on('message', async (message: AnyValue) => {
  try {
    switch (message.type) {
      case 'execute':
        // Create a function from the serialized code
        const functionBody = message.fn;
        const fn = new Function('return ' + functionBody)();

        // Execute the function
        const result = await fn();

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
