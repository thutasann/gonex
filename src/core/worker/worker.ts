/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
import { parentPort, workerData } from 'worker_threads';
import { ContextState, WorkerMessage, WorkerResponse } from '../../types';

// Global state
const globalScope = globalThis as Record<string, any>;
const contextStateRegistry = new Map<string, ContextState>();
let userFunction: string | null = null;
let context: Record<string, any> = {};

// Configuration
const userProjectDir = workerData?.userProjectDir || process.cwd();
const currentWorkingDir = workerData?.currentWorkingDir || process.cwd();
const workerId = workerData?.workerId || 0;

/**
 * Initialize essential globals in the worker scope
 */
function initializeGlobals(): void {
  const essentialGlobals = ['Promise', 'setTimeout', 'clearTimeout', 'console'];

  essentialGlobals.forEach(globalName => {
    if (typeof globalScope[globalName] === 'undefined') {
      globalScope[globalName] = (globalThis as any)[globalName];
    }
  });
}

/**
 * Create a proxy context object for worker threads
 */
function createProxyContext(serializedContext: any): any {
  if (
    !serializedContext ||
    typeof serializedContext !== 'object' ||
    !serializedContext.__isContext
  ) {
    return serializedContext;
  }

  return {
    deadline: () => serializedContext.deadline || [undefined, false],
    done: () => null,
    err: () => serializedContext.err || null,
    value: () => null,
    __isProxyContext: true,
    __originalContext: serializedContext,
  };
}

/**
 * Deserialize functions from the context
 */
function deserializeFunctions(
  variables: Record<string, any>
): Record<string, any> {
  const deserialized: Record<string, any> = {};

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
    } else {
      deserialized[key] = value;
    }
  }

  return deserialized;
}

/**
 * Set up dependencies in the worker scope
 */
function setupDependencies(dependencies: Record<string, string>): void {
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
function createEnhancedRequire(): string {
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
        
        // For npm packages, try node_modules directories
        const modulePath = path.resolve('${userProjectDir}', 'node_modules', id);
        try {
          return originalRequire(modulePath);
        } catch (secondError) {
          const examplesPath = path.resolve('${userProjectDir}', 'examples', 'node_modules', id);
          return originalRequire(examplesPath);
        }
      }
    };
  `;
}

/**
 * Create context proxy for execution
 */
function createContextProxy(): string {
  return `
    const resolvedArgs = args.map(arg => {
      if (typeof arg === 'string' && arg.startsWith('arg_func_') && globalThis[arg]) {
        return globalThis[arg];
      } else if (arg && typeof arg === 'object' && arg.__isContext) {
        const contextId = arg.contextId;
        const contextValues = arg.values || {};
        
        return {
          deadline: () => {
            const state = contextStateRegistry.get(contextId);
            return state ? state.deadline : (arg.deadline || [undefined, false]);
          },
          done: () => null,
          err: () => {
            const state = contextStateRegistry.get(contextId);
            return state ? state.err : (arg.err || null);
          },
          value: (key) => {
            if (contextValues[key] !== undefined) {
              return contextValues[key];
            }
            
            const state = contextStateRegistry.get(contextId);
            if (state && state.values && state.values[key] !== undefined) {
              return state.values[key];
            }
            
            return null;
          },
          __isProxyContext: true,
          __originalContext: arg,
          __contextId: contextId,
          __contextValues: contextValues,
        };
      }
      return arg;
    });
  `;
}

/**
 * Create execution environment code
 */
function createExecutionEnvironment(): string {
  const enhancedRequire = createEnhancedRequire();
  const contextProxy = createContextProxy();

  return `
    (async function(...args) {
      // Ensure essential globals are available
      var Promise = globalThis.Promise || Promise;
      var setTimeout = globalThis.setTimeout || setTimeout;
      var clearTimeout = globalThis.clearTimeout || clearTimeout;
      var console = globalThis.console || console;
      
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

/**
 * Handle initialization message
 */
async function handleInit(message: WorkerMessage): Promise<WorkerResponse> {
  const { functionCode, variables, dependencies } = message;

  if (!functionCode) {
    throw new Error('No function code provided');
  }

  userFunction = functionCode;

  // Set up dependencies
  if (dependencies) {
    setupDependencies(dependencies);
  }

  // Set up variables in context and deserialize functions
  if (variables && typeof variables === 'object') {
    context = deserializeFunctions(variables);
    Object.assign(globalScope, context);
  }

  return {
    id: message.id,
    success: true,
    workerId,
  };
}

/**
 * Handle execution message
 */
async function handleExecute(message: WorkerMessage): Promise<WorkerResponse> {
  const { args, invocationId, dependencies: additionalDependencies } = message;

  if (!userFunction) {
    throw new Error('Worker not initialized with function');
  }

  try {
    // Set up additional dependencies if provided
    if (additionalDependencies) {
      setupDependencies(additionalDependencies);
    }

    // Create the execution environment
    const executionCode = createExecutionEnvironment();
    const fn = eval(executionCode);
    const result = await fn(...(args || []));

    const response: WorkerResponse = {
      id: message.id,
      success: true,
      result,
      workerId,
    };

    if (invocationId) {
      response.invocationId = invocationId;
    }

    return response;
  } catch (error) {
    console.error('Worker: Error executing function:', error);

    const response: WorkerResponse = {
      id: message.id,
      success: false,
      error: (error as Error).message,
      workerId,
    };

    if (invocationId) {
      response.invocationId = invocationId;
    }

    return response;
  }
}

/**
 * Handle context update message
 */
function handleContextUpdate(message: WorkerMessage): void {
  if (message.contextState?.contextId) {
    contextStateRegistry.set(
      message.contextState.contextId,
      message.contextState
    );
  }
}

/**
 * Handle heartbeat message
 */
function handleHeartbeat(message: WorkerMessage): WorkerResponse {
  return {
    id: message.id,
    success: true,
    workerId,
  };
}

/**
 * Handle shutdown message
 */
function handleShutdown(message: WorkerMessage): WorkerResponse {
  const response = {
    id: message.id,
    success: true,
    workerId,
  };

  // Send response before exiting
  parentPort?.postMessage(response);
  process.exit(0);

  return response;
}

/**
 * Main message handler
 */
async function handleMessage(message: WorkerMessage): Promise<void> {
  try {
    let response: WorkerResponse;

    switch (message.type) {
      case 'init':
        response = await handleInit(message);
        break;
      case 'execute':
        response = await handleExecute(message);
        break;
      case 'contextUpdate':
        handleContextUpdate(message);
        return; // No response needed for context updates
      case 'heartbeat':
        response = handleHeartbeat(message);
        break;
      case 'shutdown':
        response = handleShutdown(message);
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }

    parentPort?.postMessage(response);
  } catch (error) {
    parentPort?.postMessage({
      id: message.id,
      success: false,
      error: (error as Error).message,
      workerId,
    });
  }
}

// Initialize worker
if (parentPort) {
  initializeGlobals();

  parentPort.on('message', handleMessage);
}
