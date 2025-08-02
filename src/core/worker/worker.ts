/* eslint-disable no-case-declarations */
import { parentPort, workerData } from 'worker_threads';

// Worker thread implementation
parentPort?.on('message', async (message: AnyValue) => {
  try {
    switch (message.type) {
      case 'execute':
        // Get the first argument
        const firstArg =
          message.args && message.args.length > 0 ? message.args[0] : undefined;

        // Execute the function using Function constructor with parameter
        const fn = new Function('data', `return (${message.fn})(data)`);
        const result = await fn(firstArg);

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
