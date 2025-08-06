import os from 'os';
import { join } from 'path';
import { Worker } from 'worker_threads';
import { log } from '../../utils';
import { logger } from '../../utils/logger';

/**
 * Configuration for worker thread management
 */
export type WorkerThreadConfig = {
  /** Minimum workers per thread */
  minWorkers: number;
  /** Maximum workers per thread */
  maxWorkers: number;
  /** Worker lifecycle timeout in milliseconds */
  workerTimeout: number;
  /** Load balancing strategy */
  loadBalancing: 'round-robin' | 'least-busy' | 'weighted';
  /** Enable dynamic worker scaling */
  autoScaling: boolean;
  /** Pin workers to CPU cores */
  cpuAffinity: boolean;
  /** Enable SharedArrayBuffer */
  sharedMemory: boolean;
};

/**
 * Worker thread health information
 */
export type WorkerHealth = {
  workerId: number;
  isAlive: boolean;
  lastHeartbeat: number;
  errorCount: number;
  load: number;
  memoryUsage: number;
};

/**
 * Message sent to worker threads
 */
export type WorkerMessage = {
  id: string;
  type: 'init' | 'execute' | 'heartbeat' | 'shutdown';
  functionCode?: string;
  variables?: Record<string, AnyValue>;
  dependencies?: Record<string, string>;
  args?: AnyValue[];
  invocationId?: number;
  timeout?: number;
};

/**
 * Response from worker threads
 */
export type WorkerResponse = {
  id: string;
  success: boolean;
  result?: AnyValue;
  error?: string;
  invocationId?: number;
  workerId: number;
};

/** available cpus  */
const cpus = os.cpus();

/** Message Handlers */
type MesasgeHandlers = Map<
  string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
>;

/**
 * High-performance worker thread manager
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast worker selection
 * - Efficient message passing
 * - Automatic fault tolerance
 */
export class WorkerThreadManager {
  private workers: Worker[] = [];
  private workerHealth: Map<number, WorkerHealth> = new Map();
  private messageHandlers: MesasgeHandlers = new Map();
  private config: WorkerThreadConfig;
  private isShuttingDown = false;
  private healthMonitoringInterval: NodeJS.Timeout | null = null;
  private currentWorkerIndex = 0;
  private invocationCount = 0;

  constructor(config: Partial<WorkerThreadConfig> = {}) {
    this.config = {
      minWorkers: 2,
      maxWorkers: 8,
      workerTimeout: 30000,
      loadBalancing: 'least-busy',
      autoScaling: true,
      cpuAffinity: false,
      sharedMemory: true,
      ...config,
    };
  }

  /**
   * Start the worker thread manager
   *
   * @param numWorkers - Number of worker threads to create
   */
  async start(
    numWorkers: number = Math.max(2, Math.min(8, cpus.length))
  ): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('WorkerThreadManager is shutting down');
    }

    for (let i = 0; i < numWorkers; i++) {
      await this.createWorker(i);
    }
  }

  /**
   * Create a new worker thread
   *
   * @param workerId - Unique worker ID
   */
  private async createWorker(workerId: number): Promise<void> {
    const worker = new Worker(join(__dirname, './worker.js'), {
      workerData: { workerId },
    });

    // Set up message handling
    worker.on('message', this.handleWorkerMessage.bind(this));
    worker.on('error', this.handleWorkerError.bind(this));
    worker.on('exit', this.handleWorkerExit.bind(this));

    this.workers.push(worker);
    this.workerHealth.set(workerId, {
      workerId,
      isAlive: true,
      lastHeartbeat: Date.now(),
      errorCount: 0,
      load: 0,
      memoryUsage: 0,
    });
  }

  /**
   * Serialize a function for worker thread execution
   *
   * @param fn - Function to serialize
   * @returns Object containing serialized function and dependencies
   */
  private serializeFunction(fn: (...args: AnyValue[]) => AnyValue): {
    functionCode: string;
    dependencies: Record<string, string>;
  } {
    const fnString = fn.toString();
    const dependencies: Record<string, string> = {};

    // Extract function calls from the function body
    const functionCalls = this.extractFunctionCalls(fnString);

    // Add dependencies for each function call
    for (const funcName of functionCalls) {
      if (!this.isGlobalFunction(funcName)) {
        // Try to get the function from the current scope
        const currentScope = globalThis as AnyValue;
        if (typeof currentScope[funcName] === 'function') {
          dependencies[funcName] = currentScope[funcName].toString();
        }
      }
    }

    // Create the function code
    const functionCode = `
      const fn = ${fnString};
    `;

    return {
      functionCode,
      dependencies,
    };
  }

  /**
   * Serialize arguments and extract function dependencies
   *
   * @param args - Arguments to serialize
   * @returns Object containing serialized arguments and additional dependencies
   */
  private serializeArguments(args: AnyValue[]): {
    serializedArgs: AnyValue[];
    additionalDependencies: Record<string, string>;
  } {
    const serializedArgs: AnyValue[] = [];
    const additionalDependencies: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (typeof arg === 'function') {
        // Create a unique name for this function
        const funcName = `arg_func_${i}_${Date.now()}`;

        // Serialize the function and add it to dependencies
        additionalDependencies[funcName] = arg.toString();

        // Replace the function with its name in the arguments
        serializedArgs.push(funcName);
      } else {
        serializedArgs.push(arg);
      }
    }

    return {
      serializedArgs,
      additionalDependencies,
    };
  }

  /**
   * Serialize variables following the multithreading library's approach
   *
   * @param variables - Variables to serialize
   * @returns Serialized variables
   */
  private serializeVariables(
    variables: Record<string, AnyValue>
  ): Record<string, AnyValue> {
    const serialized: Record<string, AnyValue> = {};

    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'function') {
        serialized[key] = {
          wasType: 'function',
          value: value.toString(),
        };
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  /**
   * Initialize workers with a function
   *
   * @param fn - Function to initialize workers with
   * @param context - Context variables to pass to workers
   */
  async initializeWorkers<T>(
    fn: (...args: AnyValue[]) => T | Promise<T>,
    context: Record<string, AnyValue> = {}
  ): Promise<void> {
    // Serialize the function
    const { functionCode, dependencies } = this.serializeFunction(fn);

    // Serialize variables following multithreading library's approach
    const serializedVariables = this.serializeVariables(context);

    // Initialize all workers with the function
    const initPromises = this.workers.map(async worker => {
      const messageId = this.generateMessageId();

      return new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 10000);

        const handler = (message: AnyValue) => {
          if (message.id === messageId) {
            clearTimeout(timeoutId);
            worker.off('message', handler);
            if (message.success) {
              resolve();
            } else {
              reject(
                new Error(message.error || 'Worker initialization failed')
              );
            }
          }
        };

        worker.on('message', handler);

        worker.postMessage({
          id: messageId,
          type: 'init',
          functionCode,
          variables: serializedVariables,
          dependencies,
        });
      });
    });

    await Promise.all(initPromises);
  }

  /**
   * Extract function calls from a function string
   *
   * @param fnString - Function string to analyze
   * @returns Array of function names called in the function
   */
  private extractFunctionCalls(fnString: string): string[] {
    const functionCalls: string[] = [];
    const skipList = [
      'console',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'Math',
      'JSON',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Date',
      'RegExp',
      'Error',
      'Promise',
      'async',
      'await',
      'return',
      'if',
      'else',
      'for',
      'while',
      'do',
      'switch',
      'case',
      'default',
      'try',
      'catch',
      'finally',
      'throw',
      'new',
      'typeof',
      'instanceof',
      'delete',
      'void',
      'in',
      'of',
      'yield',
      'let',
      'const',
      'var',
      'function',
      'class',
      'extends',
      'super',
      'this',
      'arguments',
      'data',
      'result',
      'error',
      'i',
      'j',
      'k',
      'x',
      'y',
      'z',
    ];

    // Find function calls using regex
    const callPattern = /\b(\w+)\s*\(/g;
    const matches = [...fnString.matchAll(callPattern)];

    for (const match of matches) {
      const funcName = match[1];
      if (
        funcName &&
        !skipList.includes(funcName) &&
        !functionCalls.includes(funcName)
      ) {
        functionCalls.push(funcName);
      }
    }

    return functionCalls;
  }

  /**
   * Check if a function is a global function
   *
   * @param funcName - Function name to check
   * @returns Whether the function is global
   */
  private isGlobalFunction(funcName: string): boolean {
    const globalFunctions = [
      'console',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'Math',
      'JSON',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Date',
      'RegExp',
      'Error',
      'Promise',
    ];
    return globalFunctions.includes(funcName);
  }

  /**
   * Execute a function on a worker thread
   *
   * @param fn - Function to execute
   * @param args - Arguments to pass to the function
   * @param timeout - Optional timeout in milliseconds
   * @returns Promise that resolves with the function result
   */
  async execute<T>(
    fn: (...args: AnyValue[]) => T | Promise<T>,
    args: AnyValue[] = [],
    timeout?: number
  ): Promise<T> {
    if (this.workers.length === 0) {
      throw new Error('No worker threads available');
    }

    // Set logger to worker thread mode
    logger.setExecutionMode('worker-thread');

    // Serialize arguments and extract function dependencies
    const { serializedArgs, additionalDependencies } =
      this.serializeArguments(args);

    // Always re-initialize workers with the new function to avoid function reuse
    await this.initializeWorkers(fn);

    // Simple round-robin for maximum speed
    const worker = this.workers[this.currentWorkerIndex]!;
    this.currentWorkerIndex =
      (this.currentWorkerIndex + 1) % this.workers.length;
    const messageId = this.generateMessageId();
    const invocationId = this.invocationCount++;
    const operationTimeout = timeout ?? this.config.workerTimeout;

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        reject(
          new Error(`Worker execution timeout after ${operationTimeout}ms`)
        );
      }, operationTimeout);

      // Store message handler
      this.messageHandlers.set(messageId, {
        resolve,
        reject,
        timeout: timeoutId,
      });

      // Send message to worker
      worker.postMessage({
        id: messageId,
        type: 'execute',
        args: serializedArgs,
        dependencies: additionalDependencies,
        invocationId,
        timeout: operationTimeout,
      });
    });
  }

  /**
   * Handle messages from worker threads
   *
   * @param message - Message from worker
   */
  private handleWorkerMessage(message: WorkerResponse): void {
    // Validate message structure
    if (!message || typeof message !== 'object') {
      console.error('Invalid message received from worker:', message);
      return;
    }

    const handler = this.messageHandlers.get(message.id);
    if (!handler) {
      return; // Message already handled or timed out
    }

    clearTimeout(handler.timeout);
    this.messageHandlers.delete(message.id);

    // Update worker health
    const health = this.workerHealth.get(message.workerId);
    if (health) {
      health.lastHeartbeat = Date.now();
      if (message.success) {
        health.errorCount = Math.max(0, health.errorCount - 1);
      } else {
        health.errorCount++;
      }
    }

    // Resolve or reject promise
    if (message.success) {
      handler.resolve(message.result);
    } else {
      handler.reject(new Error(message.error || 'Unknown error'));
    }
  }

  /**
   * Handle worker errors
   *
   * @param error - Error from worker
   */
  private handleWorkerError(error: Error): void {
    log.error('Worker error occurred', error);

    // Find the worker that had the error
    const workerIndex = this.workers.findIndex(
      worker => worker.threadId === (error as AnyValue)?.threadId
    );

    if (workerIndex !== -1) {
      const workerId = workerIndex;
      const health = this.workerHealth.get(workerId);
      if (health) {
        health.errorCount++;
        health.isAlive = false;
      }

      // Restart worker if auto-scaling is enabled
      if (this.config.autoScaling) {
        this.restartWorker(workerId);
      }
    }
  }

  /**
   * Handle worker exit
   *
   * @param code - Exit code
   */
  private handleWorkerExit(code: number): void {
    if (code !== 0) {
      console.error(`Worker exited with code ${code}`);
    }
  }

  /**
   * Restart a failed worker
   *
   * @param workerId - ID of worker to restart
   */
  private async restartWorker(workerId: number): Promise<void> {
    log.worker(`Restarting worker ${workerId}`);

    // Remove old worker
    const oldWorker = this.workers[workerId];
    if (oldWorker) {
      oldWorker.terminate();
    }

    // Create new worker
    await this.createWorker(workerId);
    log.worker(`Worker ${workerId} restarted successfully`);
  }

  /**
   * Generate a unique message ID
   *
   * @returns Unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Shutdown all worker threads
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    console.log(`Shutting down ${this.workers.length} worker threads...`);

    const shutdownPromises = this.workers.map((worker, index) => {
      return new Promise<void>(resolve => {
        let resolved = false;

        // Send shutdown message
        const messageId = this.generateMessageId();
        worker.postMessage({
          id: messageId,
          type: 'shutdown',
        });

        // Listen for exit event
        const onExit = (code: number) => {
          if (!resolved) {
            resolved = true;
            console.log(`Worker ${index} exited with code ${code}`);
            // Remove all listeners to prevent memory leaks
            worker.removeAllListeners();
            resolve();
          }
        };

        // Listen for shutdown response
        const onMessage = (message: AnyValue) => {
          if (message.id === messageId && message.success) {
            console.log(`Worker ${index} acknowledged shutdown`);
          }
        };

        worker.on('exit', onExit);
        worker.on('message', onMessage);

        // Force terminate after 1 second if not responding
        const forceTerminate = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log(`Force terminating worker ${index}`);
            worker.removeAllListeners();
            worker.terminate();
            resolve();
          }
        }, 1000);

        // Clear timeout if worker exits normally
        worker.on('exit', () => {
          clearTimeout(forceTerminate);
        });
      });
    });

    await Promise.all(shutdownPromises);

    // Clear health monitoring interval
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
      this.healthMonitoringInterval = null;
    }

    // Clear all workers array and handlers
    this.workers = [];
    this.workerHealth.clear();
    this.messageHandlers.clear();

    console.log('All worker threads shutdown complete');
  }

  /**
   * Get worker health information
   *
   * @returns Map of worker health data
   */
  getWorkerHealth(): Map<number, WorkerHealth> {
    return new Map(this.workerHealth);
  }

  /**
   * Get number of active workers
   *
   * @returns Number of active workers
   */
  getActiveWorkerCount(): number {
    return this.workers.filter((_, index) => {
      const health = this.workerHealth.get(index);
      return health && health.isAlive;
    }).length;
  }
}
