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
  type: 'execute' | 'heartbeat' | 'shutdown';
  fn?: string;
  args?: AnyValue[];
  data?: AnyValue;
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
   * Execute a function on a worker thread
   *
   * @param fn - Function to execute
   * @param timeout - Optional timeout in milliseconds
   * @param args - Optional arguments to pass to the function
   * @returns Promise that resolves with the function result
   */
  async execute<T>(
    fn: () => T | Promise<T>,
    timeout?: number,
    args?: AnyValue[]
  ): Promise<T> {
    if (this.workers.length === 0) {
      throw new Error('No worker threads available');
    }

    // Set logger to worker thread mode
    logger.setExecutionMode('worker-thread');

    // Simple round-robin for maximum speed
    const worker = this.workers[this.currentWorkerIndex]!;
    this.currentWorkerIndex =
      (this.currentWorkerIndex + 1) % this.workers.length;
    const messageId = this.generateMessageId();
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

      // Serialize the function properly
      const serializedFn = this.serializeFunction(fn);

      // Send message to worker
      worker.postMessage({
        id: messageId,
        type: 'execute',
        fn: serializedFn,
        args: args || [],
        timeout: operationTimeout,
      });
    });
  }

  /**
   * Serialize a function for worker thread execution - OPTIMIZED
   *
   * @param fn - Function to serialize
   * @returns Serialized function string
   */
  private serializeFunction(fn: (...args: AnyValue[]) => AnyValue): string {
    const fnString = fn.toString();

    // Extract the function body more robustly
    // Handle patterns like: async (/** @type {any} */ data) => { ... }
    const bodyMatch = fnString.match(/=>\s*\{([\s\S]*)\}$/);

    if (bodyMatch && bodyMatch[1]) {
      const functionBody = bodyMatch[1].trim();

      // Create a simple async function that takes a single parameter
      // This avoids complex parameter parsing issues
      const result = `async function(data) {
        ${functionBody}
      }`;

      return result;
    }

    // Fallback to original function if parsing fails
    return fnString;
  }

  /**
   * Handle messages from worker threads
   *
   * @param message - Message from worker
   */
  private handleWorkerMessage(message: WorkerResponse): void {
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
      handler.reject(new Error(message.error));
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
      worker => worker.threadId === (error as AnyValue).threadId
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

    const shutdownPromises = this.workers.map((worker, index) => {
      return new Promise<void>(resolve => {
        // Send shutdown message
        worker.postMessage({
          id: this.generateMessageId(),
          type: 'shutdown',
        });

        // Listen for exit event
        const onExit = () => {
          resolve();
        };

        worker.on('exit', onExit);

        // Force terminate after 3 seconds if not responding
        const forceTerminate = setTimeout(() => {
          log.worker(`Force terminating worker ${index}`);
          worker.terminate();
          resolve();
        }, 3000);

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

    // Clear all workers array
    this.workers = [];
    this.workerHealth.clear();
    this.messageHandlers.clear();

    log.worker('All worker threads shutdown complete');
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
