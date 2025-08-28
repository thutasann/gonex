export type WorkerPoolConfig = {
  /** Minimum number of workers to maintain */
  minWorkers: number;
  /** Maximum number of workers allowed */
  maxWorkers: number;
  /** Time in milliseconds before idle workers are terminated */
  idleTimeout: number;
  /** Time in milliseconds before a task times out */
  taskTimeout: number;
  /** Enable automatic scaling based on load */
  enableAutoScaling: boolean;
  /** CPU utilization threshold for scaling (0.0 to 1.0) */
  scalingThreshold: number;
  /** Scaling factor for worker count adjustments */
  scalingFactor: number;
  /** Maximum scaling operations per minute */
  maxScalingOperationsPerMinute: number;
  /** Enable metrics collection */
  enableMetrics: boolean;
};

export type PoolMetrics = {
  /** Current number of workers */
  workerCount: number;
  /** Current number of idle workers */
  idleWorkerCount: number;
  /** Current number of busy workers */
  busyWorkerCount: number;
  /** Current queue length */
  queueLength: number;
  /** Total tasks submitted */
  totalTasksSubmitted: number;
  /** Total tasks completed */
  totalTasksCompleted: number;
  /** Total tasks failed */
  totalTasksFailed: number;
  /** Average task processing time */
  averageTaskTime: number;
  /** Pool utilization percentage */
  utilization: number;
  /** Last scaling operation timestamp */
  lastScalingOperation: number;
  /** Scaling operations in the last minute */
  scalingOperationsLastMinute: number;
};

export type Task<TInput> = {
  /** Unique task identifier */
  id: string;
  /** Task input data */
  input: TInput;
  /** Task priority (higher = more important) */
  priority: number;
  /** Task creation timestamp */
  createdAt: number;
  /** Task timeout in milliseconds */
  timeout: number;
  /** Task metadata */
  metadata?: Record<string, AnyValue> | undefined;
};

export type CompletedTask<TInput, TOutput> = {
  /** Original task */
  task: Task<TInput>;
  /** Task result */
  result: TOutput;
  /** Task completion timestamp */
  completedAt: number;
  /** Task execution duration in milliseconds */
  duration: number;
  /** Task success status */
  success: boolean;
  /** Error message if task failed */
  error?: string;
};

export type TaskResult<TOutput> = {
  /** Task identifier */
  taskId: string;
  /** Task output data */
  output: TOutput;
  /** Task completion timestamp */
  completedAt: number;
  /** Task execution duration in milliseconds */
  duration: number;
  /** Task success status */
  success: boolean;
  /** Error message if task failed */
  error?: string;
};

export type WorkerStatus = 'idle' | 'busy' | 'starting' | 'stopping' | 'error';

export type WorkerInfo = {
  /** Worker identifier */
  id: string;
  /** Current worker status */
  status: WorkerStatus;
  /** Current task being processed */
  currentTask?: string;
  /** Worker start timestamp */
  startedAt: number;
  /** Total tasks processed by this worker */
  tasksProcessed: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Worker performance metrics */
  performance: {
    averageTaskDuration: number;
    successRate: number;
    errorCount: number;
  };
};

export type HealthStatus = {
  /** Overall pool health */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Health check timestamp */
  timestamp: number;
  /** Health details */
  details: {
    /** Worker health information */
    workers: {
      total: number;
      healthy: number;
      unhealthy: number;
      starting: number;
      stopping: number;
    };
    /** Queue health information */
    queue: {
      length: number;
      oldestTask: number;
      averageWaitTime: number;
    };
    /** Performance metrics */
    performance: {
      throughput: number;
      errorRate: number;
      averageResponseTime: number;
    };
  };
};

export type LoadBalancer<TInput> = {
  /** Select the best worker for a task */
  selectWorker(workers: WorkerInfo[], task: Task<TInput>): WorkerInfo | null;

  /** Update worker load information */
  updateWorkerLoad(workerId: string, load: number): void;

  /** Get current load distribution */
  getLoadDistribution(): Map<string, number>;
};
