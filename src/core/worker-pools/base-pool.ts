/**
 * Base Worker Pool - Abstract base class for worker pool implementations
 * Provides common functionality for worker management, task handling,
 * and metrics collection.
 */

import { logger } from '../../utils/logger';
import { BasePattern, PatternConfig } from '../patterns';
import {
  HealthStatus,
  LoadBalancer,
  PoolMetrics,
  Task,
  TaskResult,
  WorkerInfo,
  WorkerPoolConfig,
} from './types';

export abstract class BaseWorkerPool<TInput, TOutput> extends BasePattern {
  protected workers: Map<string, WorkerInfo> = new Map();
  protected taskQueue: Array<Task<TInput>> = [];
  protected override config: Required<WorkerPoolConfig & PatternConfig>;
  protected loadBalancer: LoadBalancer<TInput> | null = null;
  protected nextWorkerId: number = 1;
  protected nextTaskId: number = 1;

  constructor(config: Partial<WorkerPoolConfig>) {
    super({
      name: 'worker-pool',
      maxConcurrency: config.maxWorkers || 10,
      timeout: config.taskTimeout || 30000,
      retryAttempts: 0, // Worker pools don't retry by default
      enableMetrics: true,
      errorHandler: (error: Error, context?: AnyValue) => {
        logger.error(`Worker pool error:`, error, { context });
      },
    });

    this.config = {
      name: 'worker-pool',
      maxConcurrency: 10,
      timeout: 30000,
      retryAttempts: 0,
      enableMetrics: true,
      errorHandler: (error: Error, context?: AnyValue) => {
        logger.error(`Worker pool error:`, error, { context });
      },
      minWorkers: 1,
      maxWorkers: 10,
      idleTimeout: 60000, // 1 minute
      taskTimeout: 30000, // 30 seconds
      enableAutoScaling: false,
      scalingThreshold: 0.8,
      scalingFactor: 1.5,
      maxScalingOperationsPerMinute: 10,
      ...config,
    };
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract createWorker(): Promise<WorkerInfo>;
  protected abstract destroyWorker(workerId: string): Promise<void>;
  protected abstract executeTask(
    worker: WorkerInfo,
    task: Task<TInput>
  ): Promise<TaskResult<TOutput>>;

  // Task submission methods
  async submit(
    task: TInput,
    priority: number = 0,
    metadata?: Record<string, AnyValue>
  ): Promise<TOutput> {
    const taskObj: Task<TInput> = {
      id: this.generateTaskId(),
      input: task,
      priority,
      createdAt: Date.now(),
      timeout: this.config.taskTimeout,
      metadata,
    };

    // Add task to queue (sorted by priority)
    this.addTaskToQueue(taskObj);

    // Try to process the task immediately if workers are available
    await this.processNextTask();

    // Wait for task completion
    return this.waitForTaskCompletion(taskObj.id);
  }

  async submitBatch(tasks: TInput[], priority: number = 0): Promise<TOutput[]> {
    const taskPromises = tasks.map(task => this.submit(task, priority));
    return Promise.all(taskPromises);
  }

  // Worker management methods
  protected async addWorker(): Promise<WorkerInfo> {
    if (this.workers.size >= this.config.maxWorkers) {
      throw new Error(
        `Cannot add worker: maximum workers (${this.config.maxWorkers}) reached`
      );
    }

    const worker = await this.createWorker();
    this.workers.set(worker.id, worker);

    logger.info(`Worker ${worker.id} added to pool ${this.getName()}`);
    return worker;
  }

  protected async removeWorker(workerId: string): Promise<boolean> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }

    // Wait for worker to finish current task
    if (worker.status === 'busy') {
      worker.status = 'stopping';
      // Wait for task completion or timeout
      await this.waitForWorkerIdle(workerId);
    }

    await this.destroyWorker(workerId);
    this.workers.delete(workerId);

    logger.info(`Worker ${workerId} removed from pool ${this.getName()}`);
    return true;
  }

  // Queue management methods
  protected addTaskToQueue(task: Task<TInput>): void {
    // Insert task based on priority (higher priority first)
    const insertIndex = this.taskQueue.findIndex(
      t => t.priority < task.priority
    );
    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    this.updateMetrics();
  }

  protected getNextTask(): Task<TInput> | undefined {
    return this.taskQueue.shift();
  }

  // Task processing methods
  protected async processNextTask(): Promise<void> {
    if (this.taskQueue.length === 0) {
      return;
    }

    const availableWorker = this.getAvailableWorker();
    if (!availableWorker) {
      return;
    }

    const task = this.getNextTask();
    if (!task) {
      return;
    }

    // Execute task in background
    this.executeTask(availableWorker, task).catch(error => {
      logger.error(`Error executing task ${task.id}:`, error);
      this.handleError(error);
    });
  }

  protected getAvailableWorker(): WorkerInfo | null {
    const idleWorkers = Array.from(this.workers.values()).filter(
      w => w.status === 'idle'
    );

    if (idleWorkers.length === 0) {
      return null;
    }

    if (this.loadBalancer) {
      return this.loadBalancer.selectWorker(idleWorkers, this.taskQueue[0]!);
    }

    // Default: round-robin selection
    return idleWorkers[0]!;
  }

  // Utility methods
  protected generateTaskId(): string {
    return `task-${this.nextTaskId++}`;
  }

  protected generateWorkerId(): string {
    return `worker-${this.nextWorkerId++}`;
  }

  protected async waitForWorkerIdle(workerId: string): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds max wait
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const worker = this.workers.get(workerId);
      if (worker && worker.status === 'idle') {
        return;
      }
      await this.sleep(100);
    }

    throw new Error(`Worker ${workerId} did not become idle within timeout`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async waitForTaskCompletion(_taskId: string): Promise<TOutput> {
    // This is a simplified implementation
    // In practice, you'd want to use a more sophisticated task tracking system
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        // Check if task is completed (implementation depends on specific worker pool)
        // For now, we'll just resolve after a delay
        clearInterval(checkInterval);
        resolve({} as TOutput); // Placeholder
      }, 100);
    });
  }

  // Metrics and monitoring methods
  getWorkerCount(): number {
    return this.workers.size;
  }

  getQueueLength(): number {
    return this.taskQueue.length;
  }

  getPoolMetrics(): PoolMetrics {
    const busyWorkers = Array.from(this.workers.values()).filter(
      w => w.status === 'busy'
    ).length;

    const idleWorkers = this.workers.size - busyWorkers;

    return {
      workerCount: this.workers.size,
      idleWorkerCount: idleWorkers,
      busyWorkerCount: busyWorkers,
      queueLength: this.taskQueue.length,
      totalTasksSubmitted: this.metrics.totalOperations,
      totalTasksCompleted: this.metrics.successfulOperations,
      totalTasksFailed: this.metrics.failedOperations,
      averageTaskTime: this.metrics.averageDuration,
      utilization: this.workers.size > 0 ? busyWorkers / this.workers.size : 0,
      lastScalingOperation: 0,
      scalingOperationsLastMinute: 0,
    };
  }

  getHealthStatus(): HealthStatus {
    const workers = Array.from(this.workers.values());
    const healthyWorkers = workers.filter(w => w.status !== 'error').length;
    const totalWorkers = workers.length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (totalWorkers === 0) {
      status = 'unhealthy';
    } else if (healthyWorkers === totalWorkers) {
      status = 'healthy';
    } else if (healthyWorkers >= totalWorkers * 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: Date.now(),
      details: {
        workers: {
          total: totalWorkers,
          healthy: healthyWorkers,
          unhealthy: totalWorkers - healthyWorkers,
          starting: workers.filter(w => w.status === 'starting').length,
          stopping: workers.filter(w => w.status === 'stopping').length,
        },
        queue: {
          length: this.taskQueue.length,
          oldestTask:
            this.taskQueue.length > 0 ? this.taskQueue[0]!.createdAt : 0,
          averageWaitTime: 0, // Calculate based on completed tasks
        },
        performance: {
          throughput:
            this.metrics.totalOperations /
            Math.max(1, (Date.now() - this.startTime) / 1000),
          errorRate:
            this.metrics.totalOperations > 0
              ? this.metrics.failedOperations / this.metrics.totalOperations
              : 0,
          averageResponseTime: this.metrics.averageDuration,
        },
      },
    };
  }

  // Load balancer configuration
  setLoadBalancer(balancer: LoadBalancer<TInput>): void {
    this.loadBalancer = balancer;
  }

  // Protected helper methods
  protected override updateMetrics(): void {
    // Update metrics when queue or worker state changes
    this.metrics.activeOperations = this.taskQueue.length;
    this.metrics.peakConcurrency = Math.max(
      this.metrics.peakConcurrency,
      this.metrics.activeOperations
    );
  }

  protected override sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
