import os from 'os';
import { join } from 'path';
import { Worker } from 'worker_threads';
import {
  MessageHandlers,
  WorkerHealth,
  WorkerResponse,
  WorkerThreadConfig,
} from '../../types';
import { log, logger } from '../../utils';
import { WorkerSerializationService } from './worker-serialization-service';

/** available cpus  */
const cpus = os.cpus();

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
  private messageHandlers: MessageHandlers = new Map();
  private config: WorkerThreadConfig;
  private isShuttingDown = false;
  private healthMonitoringInterval: NodeJS.Timeout | null = null;
  private currentWorkerIndex = 0;
  private invocationCount = 0;
  private serializationService: WorkerSerializationService;

  constructor(config: Partial<WorkerThreadConfig> = {}) {
    this.config = {
      minWorkers: 2,
      maxWorkers: 8,
      workerTimeout: 30000,
      autoScaling: true,
      cpuAffinity: false,
      sharedMemory: true,
      ...config,
    };
    this.serializationService = new WorkerSerializationService();
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
    const { functionCode, dependencies } =
      await this.serializationService.serializeFunction(fn);

    // Serialize variables following multithreading library's approach
    const serializedVariables =
      this.serializationService.serializeVariables(context);

    // Initialize all workers with the function
    const initPromises = this.workers.map(async worker => {
      const messageId = this.generateMessageId();

      return new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 30000);

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
    if (this.isShuttingDown) {
      throw new Error('WorkerThreadManager is shutting down');
    }

    if (this.workers.length === 0) {
      throw new Error('No worker threads available');
    }

    // Set logger to worker thread mode
    logger.setExecutionMode('worker-thread');

    // Serialize arguments and extract function dependencies
    const { serializedArgs, additionalDependencies } =
      this.serializationService.serializeArguments(args);

    // Always re-initialize workers with the new function to avoid function reuse
    await this.initializeWorkers(fn);

    // Simple round-robin for maximum speed
    const worker = this.workers[this.currentWorkerIndex];
    if (!worker) {
      throw new Error('No worker available for execution');
    }

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
   * Shutdown all worker threads
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    logger.workerThread(
      `Shutting down ${this.workers.length} worker threads...`
    );

    // Clear all message handlers immediately to prevent new executions
    this.messageHandlers.clear();

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
            logger.workerThread(`Worker ${index} exited with code ${code}`);
            // Remove all listeners to prevent memory leaks
            worker.removeAllListeners();
            resolve();
          }
        };

        // Listen for shutdown response
        const onMessage = (message: AnyValue) => {
          if (message.id === messageId && message.success) {
            // logger.workerThread(`Worker ${index} acknowledged shutdown`);
          } else {
            logger.workerThread(`Worker ${index} failed to shutdown`);
          }
        };

        worker.on('exit', onExit);
        worker.on('message', onMessage);

        // Force terminate after 1 second if not responding
        const forceTerminate = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            logger.workerThread(`Force terminating worker ${index}`);
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
    this.serializationService.clearContextRegistry();

    logger.workerThread('All worker threads shutdown complete');
  }

  /**
   * Update context state and broadcast to all workers
   */
  updateContextState(contextId: string): void {
    const currentState = this.serializationService.getContextState(contextId);
    if (!currentState) {
      return;
    }

    // Broadcast to all workers
    this.workers.forEach(worker => {
      worker.postMessage({
        id: this.generateMessageId(),
        type: 'contextUpdate',
        contextState: currentState,
      });
    });
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

  /**
   * Create a new worker thread
   *
   * @param workerId - Unique worker ID
   */
  private async createWorker(workerId: number): Promise<void> {
    // Get the user's project directory (where the go() function is called from)
    const userProjectDir = process.cwd();

    // Get the current working directory for resolving relative imports
    const currentWorkingDir = process.cwd();

    const worker = new Worker(join(__dirname, './worker.js'), {
      workerData: {
        workerId,
        userProjectDir, // Pass the user's project directory
        currentWorkingDir, // Pass the current working directory
      },
    });

    // Set higher max listeners to prevent warnings
    worker.setMaxListeners(50);

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
}
