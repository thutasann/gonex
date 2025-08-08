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
