import {
  createContextProxy,
  createProxyChannel,
  createProxyContext,
  createProxyMutex,
  createProxyRWMutex,
  createProxySemaphore,
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
    } else if (value && typeof value === 'object' && value.__isSemaphore) {
      deserialized[key] = createProxySemaphore(value);
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
              path.resolve('${currentWorkingDir}', 'core', 'goroutines', id),
            ];
            
            for (const modulePath of possiblePaths) {
              try {
                const module = originalRequire(modulePath);
                // Apply smart proxy for .default access
                return new Proxy(module, {
                  get(target, prop) {
                    if (prop === 'default') {
                      return target.default !== undefined ? target.default : target;
                    }
                    return target[prop];
                  }
                });
              } catch (localError) {
                // Continue to next path
              }
            }
            
            throw error;
          }
          
          // For npm packages, try node_modules directories in this order:
          const possibleNodeModulesPaths = [
            path.resolve('${userProjectDir}', 'node_modules', id),
            path.resolve('${currentWorkingDir}', 'node_modules', id),
            path.resolve('${currentWorkingDir}', '..', 'node_modules', id),
            path.resolve('${currentWorkingDir}', '..', '..', 'node_modules', id),
          ];
          
          for (const modulePath of possibleNodeModulesPaths) {
            try {
              const module = originalRequire(modulePath);
              // Apply smart proxy for .default access
              return new Proxy(module, {
                get(target, prop) {
                  if (prop === 'default') {
                    return target.default !== undefined ? target.default : target;
                  }
                  return target[prop];
                }
              });
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
 * Transform import() calls to use our custom import function
 * This preserves the await import() syntax while making it work in worker threads
 */
function transformImportCalls(userFunction: string): string {
  // Replace await import('module') with await customImport('module')
  // This regex matches: await import('module') or await import("module")
  let transformed = userFunction;

  // Replace import() calls with customImport() calls
  transformed = transformed.replace(
    /await\s+import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    'await customImport("$1")'
  );

  return transformed;
}

/**
 * Create execution environment code
 */
export function createExecutionEnvironment(
  currentWorkingDir: string,
  userProjectDir: string,
  userFunction: string
): string {
  const contextProxy = createContextProxy();

  // Transform import() calls to require() calls
  const transformedFunction = transformImportCalls(userFunction);

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
        
        // Create proxy semaphore function for worker threads
        var createProxySemaphore = function(serializedSemaphore) {
          if (!serializedSemaphore || typeof serializedSemaphore !== 'object' || !serializedSemaphore.__isSemaphore) {
            return serializedSemaphore;
          }
          
          return {
            async acquire(timeout) {
              console.warn('⚠️  Semaphore in worker thread - limited synchronization guarantees');
              const permits = serializedSemaphore.availablePermits || 0;
              if (permits <= 0) {
                const delay = Math.min(timeout || 100, 50);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
              return Promise.resolve();
            },
            release() {
              console.warn('⚠️  Semaphore release in worker thread - limited synchronization guarantees');
            },
            tryAcquire() {
              console.warn('⚠️  Semaphore tryAcquire in worker thread - limited synchronization guarantees');
              return true;
            },
            getAvailablePermits() {
              return serializedSemaphore.availablePermits || 0;
            },
            getMaxPermits() {
              return serializedSemaphore.maxPermits || 1;
            },
            waitingCount() {
              return serializedSemaphore.waitingCount || 0;
            },
            isFullyUtilized() {
              return serializedSemaphore.isFullyUtilized || false;
            },
            reset() {
              console.warn('⚠️  Semaphore reset in worker thread - no effect on main thread semaphore');
            },
            __isProxySemaphore: true,
            __originalSemaphore: serializedSemaphore,
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
        

        
        // Create a custom import function that works in worker threads
        // This mimics the behavior of ES module dynamic imports
        var customImport = async function(id) {
          const path = require('path');
          
          // Handle Node.js built-in modules (node:fs, node:path, etc.)
          if (id.startsWith('node:')) {
            const moduleName = id.substring(5); // Remove 'node:' prefix
            try {
              const module = require(moduleName);
              // For built-in modules, return { default: module, ...module }
              return { default: module, ...module };
            } catch (error) {
              throw new Error('Built-in module not found: ' + moduleName);
            }
          }
          
          // Handle local files (relative paths)
          if (id.startsWith('./') || id.startsWith('../') || id.endsWith('.js')) {
            const possiblePaths = [
              path.resolve('${currentWorkingDir}', id),
              path.resolve(process.cwd(), id),
              path.resolve('${userProjectDir}', id),
              path.resolve('${currentWorkingDir}', 'core', 'goroutines', id),
            ];
            
            for (const modulePath of possiblePaths) {
              try {
                const module = require(modulePath);
                // Always return an object with default property for consistency
                // This supports both: await import('moment') and (await import('moment')).default
                if (module.default === undefined) {
                  // CommonJS module - return { default: module, ...module }
                  return { default: module, ...module };
                } else {
                  // ES module - return { default: module.default, ...module }
                  return { default: module.default, ...module };
                }
              } catch (localError) {
                // Continue to next path
              }
            }
            
            throw new Error('Module not found: ' + id);
          }
          
          // For npm packages, try node_modules directories in this order:
          const possibleNodeModulesPaths = [
            path.resolve('${userProjectDir}', 'node_modules', id),
            path.resolve('${currentWorkingDir}', 'node_modules', id),
            path.resolve('${currentWorkingDir}', '..', 'node_modules', id),
            path.resolve('${currentWorkingDir}', '..', '..', 'node_modules', id),
          ];
          
          for (const modulePath of possibleNodeModulesPaths) {
            try {
              const module = require(modulePath);
              // Always return an object with default property for consistency
              // This supports both: await import('moment') and (await import('moment')).default
              if (module.default === undefined) {
                // CommonJS module - return { default: module, ...module }
                return { default: module, ...module };
              } else {
                // ES module - return { default: module.default, ...module }
                return { default: module.default, ...module };
              }
            } catch (moduleError) {
              // Continue to next path
            }
          }
          
          throw new Error('Package not found: ' + id);
        };
        
        // Make the custom import function available globally
        // Users can call customImport('moment') instead of import('moment')
        globalThis.customImport = customImport;
        
        // Resolve function arguments and handle context objects
        ${contextProxy}
        
        // Create the user function (with transformed import calls)
        ${transformedFunction}
        
        // Execute the function with the resolved arguments
        return await fn(...resolvedArgs);
      })
    `;
}
