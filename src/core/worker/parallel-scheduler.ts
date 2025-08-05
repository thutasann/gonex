import os from 'os';
import { DEFAULT_TIMEOUT, log, validateTimeout } from '../../utils';
import { logger } from '../../utils/logger';
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

/** available cpus  */
const cpus = os.cpus();

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
  private defaultOptions: ParallelOptions;

  constructor(defaultOptions: ParallelOptions = {}) {
    this.defaultOptions = {
      useWorkerThreads: false, // Default to single-threaded for backward compatibility
      threadCount: 'auto',
      cpuAffinity: false,
      sharedMemory: true,
      timeout: DEFAULT_TIMEOUT,
      ...defaultOptions,
    };
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

    const config = { ...this.defaultOptions, ...options };

    if (config.useWorkerThreads) {
      const threadCount =
        config.threadCount === 'auto'
          ? Math.max(2, Math.min(8, cpus.length))
          : (config.threadCount as number);

      this.workerThreadManager = new WorkerThreadManager({
        minWorkers: threadCount || 2,
        maxWorkers: threadCount || 8,
        workerTimeout: config.timeout || 30000,
        autoScaling: true,
        cpuAffinity: config.cpuAffinity || false,
        sharedMemory: config.sharedMemory || true,
      });

      await this.workerThreadManager.start(threadCount);
      log.parallel(`Initialized with ${threadCount} worker threads`, {
        threadCount,
      });
    }

    this.isInitialized = true;
  }

  /**
   * Execute a function with parallel capabilities
   *
   * @param fn - Function to execute
   * @param options - Execution options
   * @returns Promise that resolves with the function result
   */
  async go<T>(
    fn: () => T | Promise<T>,
    options: ParallelOptions = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };

    // Validate timeout if provided
    if (config.timeout !== undefined) {
      validateTimeout(config.timeout);
    }

    // Use worker threads if enabled
    if (config.useWorkerThreads && this.workerThreadManager) {
      logger.setExecutionMode('worker-thread');
      return this.workerThreadManager.execute(fn, config.timeout);
    }

    // Fallback to single-threaded execution
    logger.setExecutionMode('event-loop');
    return this.executeSingleThreaded(fn);
  }

  /**
   * Execute function in single-threaded mode (current implementation)
   *
   * @param fn - Function to execute
   * @param options - Execution options
   * @returns Promise that resolves with the function result
   */
  private async executeSingleThreaded<T>(fn: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      setImmediate(async () => {
        try {
          const result = fn();
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
   * Execute multiple functions in parallel
   *
   * @param fns - Array of functions to execute
   * @param options - Execution options
   * @returns Promise that resolves with array of results
   */
  async goAll<T>(
    fns: Array<() => T | Promise<T>>,
    options: ParallelOptions = {}
  ): Promise<T[]> {
    const promises = fns.map(fn => this.go(fn, options));
    return Promise.all(promises);
  }

  /**
   * Execute multiple functions and return the first result
   *
   * @param fns - Array of functions to execute
   * @param options - Execution options
   * @returns Promise that resolves with the first result
   */
  async goRace<T>(
    fns: Array<() => T | Promise<T>>,
    options: ParallelOptions = {}
  ): Promise<T> {
    const promises = fns.map(fn => this.go(fn, options));
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
   * Shutdown the parallel scheduler
   */
  async shutdown(): Promise<void> {
    if (this.workerThreadManager) {
      await this.workerThreadManager.shutdown();
    }
    this.isInitialized = false;
  }
}
