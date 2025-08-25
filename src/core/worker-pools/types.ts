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
  metadata?: Record<string, AnyValue>;
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
