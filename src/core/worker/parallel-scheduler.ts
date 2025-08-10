import os from 'os';
import { DEFAULT_TIMEOUT, log, validateTimeout } from '../../utils';
import { logger } from '../../utils/logger';
import {
  clearContextCancellationCallback,
  setContextCancellationCallback,
} from '../context';
import { WorkerThreadManager } from './worker-thread-manager';

/**
 * Options for parallel execution
 */
export type ParallelOptions = {
  /** Use worker threads for execution */
  useWorkerThreads?: boolean;
  /** Number of worker threads to use */
  threadCount?: number | 'auto';
  /** CPU affinity for worker threads */
  cpuAffinity?: boolean;
  /** Enable shared memory */
  sharedMemory?: boolean;
  /** Timeout for worker execution */
  timeout?: number;
};

/**
 * Configuration for parallel scheduler
 */
type SchedulerConfig = Required<ParallelOptions>;

/**
 * Execution mode types
 */
export type ExecutionMode = 'worker-thread' | 'event-loop';

/**
 * Available CPUs
 */
const cpus = os.cpus();

/**
 * Calculate optimal thread count based on CPU cores
 */
function calculateThreadCount(requestedCount: number | 'auto'): number {
  if (requestedCount === 'auto') {
    return Math.max(2, Math.min(8, cpus.length));
  }
  return requestedCount;
}

/**
 * Create default scheduler configuration
 */
function createDefaultConfig(options: ParallelOptions = {}): SchedulerConfig {
  return {
    useWorkerThreads: false, // Default to single-threaded for backward compatibility
    threadCount: 'auto',
    cpuAffinity: false,
    sharedMemory: true,
    timeout: DEFAULT_TIMEOUT,
    ...options,
  };
}

/**
 * High-performance parallel scheduler
 *
 * Optimized for:
 * - Seamless API migration
 * - Intelligent worker selection
 * - Efficient resource management
 * - Automatic fault tolerance
 */
export class ParallelScheduler {
  private workerThreadManager: WorkerThreadManager | null = null;
  private isInitialized = false;
  private defaultConfig: SchedulerConfig;

  constructor(defaultOptions: ParallelOptions = {}) {
    this.defaultConfig = createDefaultConfig(defaultOptions);
  }

  /**
   * Initialize worker thread manager
   */
  private async initializeWorkerThreads(
    config: SchedulerConfig
  ): Promise<void> {
    const threadCount = calculateThreadCount(config.threadCount);

    this.workerThreadManager = new WorkerThreadManager({
      minWorkers: threadCount,
      maxWorkers: threadCount,
      workerTimeout: config.timeout,
      autoScaling: true,
      cpuAffinity: config.cpuAffinity,
      sharedMemory: config.sharedMemory,
    });

    await this.workerThreadManager.start(threadCount);

    // Set up context cancellation callback for worker threads
    setContextCancellationCallback((contextId: string) => {
      if (this.workerThreadManager) {
        this.workerThreadManager.updateContextState(contextId);
      }
    });

    // Set execution mode to worker thread
    logger.setExecutionMode('worker-thread');

    log.parallel(`Initialized with ${threadCount} worker threads`, {
      threadCount,
    });
  }

  /**
   * Initialize the parallel scheduler
   *
   * @param options - Initialization options
   */
  async initialize(options: Partial<ParallelOptions> = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const config = { ...this.defaultConfig, ...options };

    if (config.useWorkerThreads) {
      await this.initializeWorkerThreads(config);
    }

    this.isInitialized = true;
  }

  /**
   * Execute function in single-threaded mode
   *
   * @param fn - Function to execute
   * @param args - Arguments to pass to the function
   * @returns Promise that resolves with the function result
   */
  private async executeSingleThreaded<T>(
    fn: (...args: AnyValue[]) => T | Promise<T>,
    args: AnyValue[] = []
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      setImmediate(async () => {
        try {
          const result = fn(...args);
          if (result instanceof Promise) {
            resolve(await result);
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Execute function using worker threads
   *
   * @param fn - Function to execute
   * @param args - Arguments to pass to the function
   * @param timeout - Timeout for execution
   * @returns Promise that resolves with the function result
   */
  private async executeWithWorkerThreads<T>(
    fn: (...args: AnyValue[]) => T | Promise<T>,
    args: AnyValue[] = [],
    timeout?: number
  ): Promise<T> {
    if (!this.workerThreadManager) {
      throw new Error('Worker thread manager not initialized');
    }

    logger.setExecutionMode('worker-thread');
    return this.workerThreadManager.execute(fn, args, timeout);
  }

  /**
   * Determine execution mode and execute function
   *
   * @param fn - Function to execute
   * @param args - Arguments to pass to the function
   * @param config - Execution configuration
   * @returns Promise that resolves with the function result
   */
  private async executeFunction<T>(
    fn: (...args: AnyValue[]) => T | Promise<T>,
    args: AnyValue[] = [],
    config: SchedulerConfig
  ): Promise<T> {
    // Validate timeout if provided
    if (config.timeout !== undefined) {
      validateTimeout(config.timeout);
    }

    // Use worker threads if enabled and available
    if (config.useWorkerThreads && this.workerThreadManager) {
      return this.executeWithWorkerThreads(fn, args, config.timeout);
    }

    // Fallback to single-threaded execution
    logger.setExecutionMode('event-loop');
    return this.executeSingleThreaded(fn, args);
  }

  /**
   * Execute a function with parallel capabilities
   *
   * @param fn - Function to execute
   * @param args - Arguments to pass to the function
   * @param options - Execution options
   * @returns Promise that resolves with the function result
   */
  async go<T>(
    fn: (...args: AnyValue[]) => T | Promise<T>,
    args: AnyValue[] = [],
    options: ParallelOptions = {}
  ): Promise<T> {
    const config = { ...this.defaultConfig, ...options };
    return this.executeFunction(fn, args, config);
  }

  /**
   * Execute multiple functions in parallel
   *
   * @param fns - Array of functions to execute
   * @param argsArray - Array of argument arrays for each function
   * @param options - Execution options
   * @returns Promise that resolves with array of results
   */
  async goAll<T>(
    fns: Array<(...args: AnyValue[]) => T | Promise<T>>,
    argsArray: AnyValue[][] = [],
    options: ParallelOptions = {}
  ): Promise<T[]> {
    const promises = fns.map((fn, index) =>
      this.go(fn, argsArray[index] || [], options)
    );
    return Promise.all(promises);
  }

  /**
   * Execute multiple functions and return the first result
   *
   * @param fns - Array of functions to execute
   * @param argsArray - Array of argument arrays for each function
   * @param options - Execution options
   * @returns Promise that resolves with the first result
   */
  async goRace<T>(
    fns: Array<(...args: AnyValue[]) => T | Promise<T>>,
    argsArray: AnyValue[][] = [],
    options: ParallelOptions = {}
  ): Promise<T> {
    const promises = fns.map((fn, index) =>
      this.go(fn, argsArray[index] || [], options)
    );
    return Promise.race(promises);
  }

  /**
   * Get worker health information
   *
   * @returns Map of worker health data or null if not using worker threads
   */
  getWorkerHealth(): Map<number, AnyValue> | null {
    return this.workerThreadManager?.getWorkerHealth() || null;
  }

  /**
   * Get number of active workers
   *
   * @returns Number of active workers or 0 if not using worker threads
   */
  getActiveWorkerCount(): number {
    return this.workerThreadManager?.getActiveWorkerCount() || 0;
  }

  /**
   * Get current execution mode
   *
   * @returns Current execution mode
   */
  getExecutionMode(): ExecutionMode {
    return this.workerThreadManager ? 'worker-thread' : 'event-loop';
  }

  /**
   * Check if worker threads are available
   *
   * @returns True if worker threads are initialized and available
   */
  isWorkerThreadsAvailable(): boolean {
    return this.workerThreadManager !== null;
  }

  /**
   * Shutdown the parallel scheduler
   */
  async shutdown(): Promise<void> {
    if (this.workerThreadManager) {
      await this.workerThreadManager.shutdown();
      clearContextCancellationCallback(); // Clear context cancellation callback on shutdown
    }
    this.isInitialized = false;
  }
}
