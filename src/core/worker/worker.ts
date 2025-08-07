/* eslint-disable no-case-declarations */
import { parentPort, workerData } from 'worker_threads';
import { logger } from '../../utils';

/**
 * Deserialize functions from the context
 */
function deserializeFunctions(
  variables: Record<string, AnyValue>
): Record<string, AnyValue> {
  const deserialized: Record<string, AnyValue> = {};

  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'object' && value !== null && 'wasType' in value) {
      if (value.wasType === 'function') {
        // Create the function from its string representation
        try {
          const func = new Function(`return ${value.value}`)();
          deserialized[key] = func;
        } catch (error) {
          console.warn(`Failed to deserialize function ${key}:`, error);
        }
      } else {
        deserialized[key] = value;
      }
    } else {
      deserialized[key] = value;
    }
  }

  return deserialized;
}

// Worker thread implementation
if (parentPort) {
  // Initialize global scope for worker
  const globalScope = globalThis as AnyValue;

  // Get user's project directory from worker data
  const userProjectDir = workerData?.userProjectDir || process.cwd();

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

          // Set up variables in context and deserialize functions
          if (variables && typeof variables === 'object') {
            context = deserializeFunctions(variables);
            // Make context available in global scope
            Object.assign(globalScope, context);
          }

          parentPort?.postMessage({
            id: message.id,
            success: true,
            workerId: workerData?.workerId || 0,
          });
          break;

        case 'execute':
          // Execute the function with arguments
          const {
            args,
            invocationId,
            dependencies: additionalDependencies,
          } = message;

          if (!userFunction) {
            throw new Error('Worker not initialized with function');
          }

          try {
            // Set up additional dependencies if provided
            if (
              additionalDependencies &&
              typeof additionalDependencies === 'object'
            ) {
              for (const [name, code] of Object.entries(
                additionalDependencies
              )) {
                try {
                  // Create the dependency function in the worker context
                  const func = new Function(`return ${code}`)();
                  globalScope[name] = func;
                } catch (error) {
                  console.warn(
                    `Failed to create additional dependency ${name}:`,
                    error
                  );
                }
              }
            }

            // Create the execution environment
            const executionCode = `
              (async function(...args) {
                // Ensure essential globals are available
                var Promise = globalThis.Promise || Promise;
                var setTimeout = globalThis.setTimeout || setTimeout;
                var clearTimeout = globalThis.clearTimeout || clearTimeout;
                var console = globalThis.console || console;
                
                // Set up module resolution to use user's project directory
                const userProjectDir = '${userProjectDir}';
                
                // Override require to resolve from user's project directory
                const originalRequire = require;
                require = function(id) {
                  try {
                    return originalRequire(id);
                  } catch (error) {
                    // Try resolving from user's project directory
                    const path = require('path');
                    const modulePath = path.resolve(userProjectDir, 'node_modules', id);
                    try {
                      return originalRequire(modulePath);
                    } catch (secondError) {
                      // If that fails, try the examples directory
                      const examplesPath = path.resolve(userProjectDir, 'examples', 'node_modules', id);
                      return originalRequire(examplesPath);
                    }
                  }
                };
                
                // Resolve function arguments
                const resolvedArgs = args.map(arg => {
                  if (typeof arg === 'string' && arg.startsWith('arg_func_') && globalThis[arg]) {
                    return globalThis[arg];
                  }
                  return arg;
                });
                
                // Create the user function
                ${userFunction}
                
                // Execute the function with the resolved arguments
                return await fn(...resolvedArgs);
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
          // Exit immediately after sending response
          logger.warn(`Worker ${workerData?.workerId || 0} shutting down...`);
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
        workerId: workerData?.workerId || 0,
      });
    }
  });
}
