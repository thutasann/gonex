export type ContextState = {
  deadline?: [Date | undefined, boolean];
  err?: Error | null;
  values?: Record<string, AnyValue>;
};

export type WorkerMessage = {
  id: string;
  type: 'init' | 'execute' | 'contextUpdate' | 'heartbeat' | 'shutdown';
  functionCode?: string;
  variables?: Record<string, AnyValue>;
  dependencies?: Record<string, string>;
  args?: AnyValue[];
  invocationId?: string;
  contextState?: ContextState & { contextId: string };
};

export type WorkerResponse = {
  id: string;
  success: boolean;
  result?: AnyValue;
  error?: string;
  invocationId?: string;
  workerId: number;
};

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

/** Message Handlers */
export type MessageHandlers = Map<
  string,
  {
    resolve: (value: AnyValue) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }
>;
