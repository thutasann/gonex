import {
  createContextProxy,
  createProxyChannel,
  createProxyContext,
  createProxyMutex,
  createProxyRWMutex,
} from './proxies';

/**
 * Deserialize functions from the context
 */
export function deserializeFunctions(
  variables: Record<string, AnyValue>
): Record<string, AnyValue> {
  const deserialized: Record<string, AnyValue> = {};

  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'object' && value !== null && 'wasType' in value) {
      if (value.wasType === 'function') {
        try {
          const func = new Function(`return ${value.value}`)();
          deserialized[key] = func;
        } catch (error) {
          console.warn(`Failed to deserialize function ${key}:`, error);
        }
      } else {
        deserialized[key] = value;
      }
    } else if (value && typeof value === 'object' && value.__isContext) {
      deserialized[key] = createProxyContext(value);
    } else if (value && typeof value === 'object' && value.__isRWMutex) {
      deserialized[key] = createProxyRWMutex(value);
    } else if (value && typeof value === 'object' && value.__isMutex) {
      deserialized[key] = createProxyMutex(value);
    } else if (value && typeof value === 'object' && value.__isChannel) {
      deserialized[key] = createProxyChannel(value);
    } else {
      deserialized[key] = value;
    }
  }

  return deserialized;
}

/**
 * Set up dependencies in the worker scope
 */
export function setupDependencies(
  globalScope: Record<string, AnyValue>,
  dependencies: Record<string, string>
): void {
  if (!dependencies || typeof dependencies !== 'object') return;

  for (const [name, code] of Object.entries(dependencies)) {
    try {
      const func = new Function(`return ${code}`)();
      globalScope[name] = func;
    } catch (error) {
      console.warn(`Failed to create dependency ${name}:`, error);
    }
  }
}

/**
 * Create enhanced require function for module resolution
 */
export function createEnhancedRequire(
  currentWorkingDir: string,
  userProjectDir: string
): string {
  return `
      const originalRequire = require;
      require = function(id) {
        try {
          return originalRequire(id);
        } catch (error) {
          const path = require('path');
          
          // Handle local files (relative paths)
          if (id.startsWith('./') || id.startsWith('../') || id.endsWith('.js')) {
            const possiblePaths = [
              path.resolve('${currentWorkingDir}', id),
              path.resolve(process.cwd(), id),
              path.resolve('${userProjectDir}', id),
              path.resolve('${userProjectDir}', 'examples', id),
              path.resolve('${userProjectDir}', 'examples', 'core', 'goroutines', id),
              path.resolve('${currentWorkingDir}', 'core', 'goroutines', id),
            ];
            
            for (const modulePath of possiblePaths) {
              try {
                return originalRequire(modulePath);
              } catch (localError) {
                // Continue to next path
              }
            }
            
            throw error;
          }
          
          // For npm packages, try node_modules directories in this order:
          const possibleNodeModulesPaths = [
            path.resolve('${userProjectDir}', 'node_modules', id),
            path.resolve('${userProjectDir}', 'examples', 'node_modules', id),
            path.resolve('${currentWorkingDir}', 'node_modules', id),
            path.resolve('${currentWorkingDir}', '..', 'node_modules', id),
            path.resolve('${currentWorkingDir}', '..', '..', 'node_modules', id),
            path.resolve('${currentWorkingDir}', '..', '..', 'examples', 'node_modules', id),
          ];
          
          for (const modulePath of possibleNodeModulesPaths) {
            try {
              return originalRequire(modulePath);
            } catch (moduleError) {
              // Continue to next path
            }
          }
          
          throw error;
        }
      };
    `;
}

/**
 * Create execution environment code
 */
export function createExecutionEnvironment(
  currentWorkingDir: string,
  userProjectDir: string,
  userFunction: string
): string {
  const enhancedRequire = createEnhancedRequire(
    currentWorkingDir,
    userProjectDir
  );
  const contextProxy = createContextProxy();

  return `
      (async function(...args) {
        // Ensure essential globals are available
        var Promise = globalThis.Promise || Promise;
        var setTimeout = globalThis.setTimeout || setTimeout;
        var clearTimeout = globalThis.clearTimeout || clearTimeout;
        var console = globalThis.console || console;
        
        // Create proxy functions for worker threads
        var createProxyChannel = function(serializedChannel) {
          if (!serializedChannel || typeof serializedChannel !== 'object' || !serializedChannel.__isChannel) {
            return serializedChannel;
          }
          
          return {
            async send(value, timeout) {
              throw new Error(
                'Channel send operations are not supported across worker thread boundaries. ' +
                'Please use channel operations in the main thread and pass results to workers.' +
                '\\n\\nValue: ' + value + '\\n\\nTimeout: ' + timeout
              );
            },
            async receive(timeout) {
              throw new Error(
                'Channel receive operations are not supported across worker thread boundaries. ' +
                'Please use channel operations in the main thread and pass results to workers.' +
                '\\n\\nTimeout: ' + timeout
              );
            },
            trySend(value) {
              if (value !== undefined) {
                throw new Error(
                  'Channel send operations are not supported across worker thread boundaries. ' +
                  'Please use channel operations in the main thread and pass results to workers.' +
                  '\\n\\nValue: ' + value
                );
              }
              return false;
            },
            tryReceive() {
              return undefined;
            },
            close() {
              throw new Error(
                'Channel close operations are not supported across worker thread boundaries.' +
                '\\n\\nChannel ID: ' + serializedChannel.channelId
              );
            },
            isClosed() {
              return serializedChannel.isClosed || false;
            },
            length() {
              return serializedChannel.length || 0;
            },
            capacity() {
              return serializedChannel.bufferSize || 0;
            },
            __isProxyChannel: true,
            __originalChannel: serializedChannel,
          };
        };
        
        // Create a working select implementation for worker threads
        var select = async function(cases, options = {}) {
          const { timeout = -1, default: defaultCase } = options;
          
          // Simple polling implementation for worker threads
          // This is a simplified version that works with the basic use cases
          const startTime = Date.now();
          const pollInterval = 1; // Start with 1ms polling
          
          return new Promise((resolve) => {
            function poll() {
              // Try all cases
              for (let i = 0; i < cases.length; i++) {
                const selectCase = cases[i];
                if (!selectCase) continue;
                
                const { channel, operation, value, handler } = selectCase;
                
                if (operation === 'send') {
                  if (value !== undefined && channel && channel.trySend) {
                    try {
                      if (channel.trySend(value)) {
                        if (handler) handler(value);
                        resolve(value);
                        return;
                      }
                    } catch (error) {
                      // Channel operation not supported, continue
                    }
                  }
                } else if (operation === 'receive') {
                  if (channel && channel.tryReceive) {
                    const received = channel.tryReceive();
                    if (received !== undefined) {
                      if (handler) handler(received);
                      resolve(received);
                      return;
                    }
                  }
                }
              }
              
              // Check timeout
              if (timeout !== -1 && Date.now() - startTime >= timeout) {
                if (defaultCase) {
                  defaultCase();
                }
                resolve(undefined);
                return;
              }
              
              // Execute default case if provided and no timeout
              if (defaultCase && timeout === -1) {
                defaultCase();
                resolve(undefined);
                return;
              }
              
              // Schedule next poll
              setTimeout(poll, pollInterval);
            }
            
            // Start polling
            poll();
          });
        };
        
        // Set up module resolution
        ${enhancedRequire}
        
        // Resolve function arguments and handle context objects
        ${contextProxy}
        
        // Create the user function
        ${userFunction}
        
        // Execute the function with the resolved arguments
        return await fn(...resolvedArgs);
      })
    `;
}
