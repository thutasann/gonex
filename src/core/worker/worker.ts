import { parentPort, workerData } from 'worker_threads';
import { ContextState, WorkerMessage, WorkerResponse } from '../../types';
import {
  createExecutionEnvironment,
  deserializeFunctions,
  setupDependencies,
} from './helpers/execution';

// Global state
const globalScope = globalThis as Record<string, AnyValue>;
const contextStateRegistry = new Map<string, ContextState>();
let userFunction: string | null = null;
let context: Record<string, AnyValue> = {};

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
      globalScope[globalName] = (globalThis as AnyValue)[globalName];
    }
  });
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
    setupDependencies(globalScope, dependencies);
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
      setupDependencies(globalScope, additionalDependencies);
    }

    // Create the execution environment
    const executionCode = createExecutionEnvironment(
      currentWorkingDir,
      userProjectDir,
      userFunction
    );
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

  // Exit asynchronously to allow message to be sent
  setTimeout(() => {
    process.exit(0);
  }, 20);

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
        handleShutdown(message);
        return; // Shutdown handles its own response
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
