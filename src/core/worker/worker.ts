/* eslint-disable no-case-declarations */
import { parentPort, workerData } from 'worker_threads';

// Worker thread implementation
if (parentPort) {
  // Initialize global scope for worker
  const globalScope = globalThis as AnyValue;

  // Ensure essential globals are available
  if (typeof Promise === 'undefined') {
    globalScope.Promise = Promise;
  }
  if (typeof setTimeout === 'undefined') {
    globalScope.setTimeout = setTimeout;
  }
  if (typeof clearTimeout === 'undefined') {
    globalScope.clearTimeout = clearTimeout;
  }
  if (typeof console === 'undefined') {
    globalScope.console = console;
  }

  // Store the user function and context
  let userFunction: string | null = null;
  let context: Record<string, AnyValue> = {};

  parentPort?.on('message', async (message: AnyValue) => {
    try {
      switch (message.type) {
        case 'init':
          // Initialize the worker with function and context
          const { functionCode, variables, dependencies } = message;

          if (!functionCode) {
            throw new Error('No function code provided');
          }

          // Store the user function
          userFunction = functionCode;

          // Set up dependencies in worker scope
          if (dependencies && typeof dependencies === 'object') {
            for (const [name, code] of Object.entries(dependencies)) {
              try {
                // Create the dependency function in the worker context
                const func = new Function(`return ${code}`)();
                globalScope[name] = func;
              } catch (error) {
                console.warn(`Failed to create dependency ${name}:`, error);
              }
            }
          }

          // Set up variables in context
          if (variables && typeof variables === 'object') {
            context = { ...variables };
          }

          parentPort?.postMessage({
            id: message.id,
            success: true,
            workerId: workerData?.workerId || 0,
          });
          break;

        case 'execute':
          // Execute the function with arguments
          const { args, invocationId } = message;

          if (!userFunction) {
            throw new Error('Worker not initialized with function');
          }

          try {
            // Create a safe execution environment with the user function
            const executionCode = `
              (async function(...args) {
                // Ensure essential globals are available
                var Promise = globalThis.Promise || Promise;
                var setTimeout = globalThis.setTimeout || setTimeout;
                var clearTimeout = globalThis.clearTimeout || clearTimeout;
                var console = globalThis.console || console;
                
                // Make context available
                var context = ${JSON.stringify(context)};
                
                // User function
                ${userFunction}
                
                // Execute the function
                return await fn(...args);
              })
            `;

            const fn = eval(executionCode);
            const result = await fn(...(args || []));

            parentPort?.postMessage({
              id: message.id,
              success: true,
              result,
              invocationId,
              workerId: workerData?.workerId || 0,
            });
          } catch (error) {
            console.error('Worker: Error executing function:', error);

            parentPort?.postMessage({
              id: message.id,
              success: false,
              error: (error as Error).message,
              invocationId,
              workerId: workerData?.workerId || 0,
            });
          }
          break;

        case 'heartbeat':
          parentPort?.postMessage({
            id: message.id,
            success: true,
            workerId: workerData?.workerId || 0,
          });
          break;

        case 'shutdown':
          parentPort?.postMessage({
            id: message.id,
            success: true,
            workerId: workerData?.workerId || 0,
          });
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
        workerId: workerData?.workerId || 0,
      });
    }
  });
}
