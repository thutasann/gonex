/* eslint-disable no-case-declarations */
import { parentPort, workerData } from 'worker_threads';

// Worker thread implementation
if (parentPort) {
  // Initialize function registry in worker
  (globalThis as AnyValue).functionRegistry = new Map();

  // Ensure global constructors are available
  if (typeof Array === 'undefined') {
    (globalThis as AnyValue).Array = Array;
  }
  if (typeof Object === 'undefined') {
    (globalThis as AnyValue).Object = Object;
  }
  if (typeof Promise === 'undefined') {
    (globalThis as AnyValue).Promise = Promise;
  }
  if (typeof setTimeout === 'undefined') {
    (globalThis as AnyValue).setTimeout = setTimeout;
  }
  if (typeof clearTimeout === 'undefined') {
    (globalThis as AnyValue).clearTimeout = clearTimeout;
  }

  parentPort?.on('message', async (message: AnyValue) => {
    try {
      switch (message.type) {
        case 'register_function':
          // Register a function in the worker's registry
          const registry = (globalThis as AnyValue).functionRegistry;
          registry.set(message.functionId, {
            serializedFn: message.serializedFn,
            dependencies: message.dependencies,
          });

          parentPort?.postMessage({
            id: message.id,
            success: true,
            workerId: workerData.workerId,
          });
          break;

        case 'execute':
          // Get function from registry
          const functionId = message.functionId;
          if (!functionId) {
            throw new Error('No function ID provided');
          }

          // Get function from the worker's registry
          const workerRegistry = (globalThis as AnyValue).functionRegistry;
          if (!workerRegistry) {
            throw new Error('Function registry not available in worker');
          }

          const entry = workerRegistry.get(functionId);
          if (!entry) {
            throw new Error(
              `Function with ID '${functionId}' not found in registry`
            );
          }

          // Set up dependencies
          if (
            entry.dependencies &&
            typeof entry.dependencies === 'object' &&
            entry.dependencies !== null &&
            entry.dependencies.constructor !== Array
          ) {
            try {
              // Use a more robust approach to iterate over dependencies
              const dependencyNames = [];
              for (const key in entry.dependencies) {
                dependencyNames.push(key);
              }

              for (const funcName of dependencyNames) {
                try {
                  const funcString = entry.dependencies[funcName];
                  // Create the function in the worker context
                  const func = new Function(`return ${funcString}`)();
                  (globalThis as AnyValue)[funcName] = func;
                } catch (error) {
                  console.warn(
                    `Failed to create dependency ${funcName}:`,
                    error
                  );
                }
              }
            } catch (error) {
              console.warn('Failed to process dependencies:', error);
            }
          } else {
            console.log('No dependencies for function:', functionId);
          }

          // Execute the function
          try {
            // Create a wrapper that makes Promise available in the function scope
            const fnString = `
              (async function(data) {
                var Promise = globalThis.Promise || Promise;
                var setTimeout = globalThis.setTimeout || setTimeout;
                var clearTimeout = globalThis.clearTimeout || clearTimeout;
                var console = globalThis.console || console;
                ${entry.serializedFn
                  .replace(/new Promise/g, 'new Promise')
                  .replace(/async function\(data\) \{/, '')
                  .replace(/\}$/, '')}
              })
            `;

            const fn = eval(fnString);
            const result = await fn(message.data);

            parentPort?.postMessage({
              id: message.id,
              success: true,
              result,
              workerId: workerData?.workerId || 0,
            });
          } catch (error) {
            console.error(
              'Worker: Error executing function:',
              functionId,
              'Error:',
              error
            );

            parentPort?.postMessage({
              id: message.id,
              success: false,
              error: (error as Error).message,
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
          // Send confirmation before exiting
          parentPort?.postMessage({
            id: message.id,
            success: true,
            workerId: workerData?.workerId || 0,
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
        workerId: workerData?.workerId || 0,
      });
    }
  });
}
