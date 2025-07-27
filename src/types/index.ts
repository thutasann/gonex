// Channel types
export interface ChannelOptions {
  bufferSize?: number;
  timeout?: number;
}

// Select types
export interface SelectCase<T = any> {
  channel: Channel<T>;
  operation: 'send' | 'receive';
  value?: T;
  handler: (value: T) => void | Promise<void>;
}

// Context types
export interface ContextOptions {
  timeout?: number;
  deadline?: Date;
  values?: Record<string, any>;
}

// Worker Pool types
export interface WorkerPoolOptions {
  size: number;
  maxQueueSize?: number;
  timeout?: number;
}

// Pipeline types
export interface PipelineOptions {
  bufferSize?: number;
  concurrency?: number;
}

// Rate Limiter types
export interface RateLimiterOptions {
  maxRequests: number;
  timeWindow: number; // in milliseconds
  burstSize?: number;
}

// Circuit Breaker types
export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number; // in milliseconds
  expectedErrors?: Array<string | RegExp>;
}

// Retry types
export interface RetryOptions {
  maxAttempts: number;
  backoff?: 'fixed' | 'exponential' | 'linear';
  initialDelay?: number; // in milliseconds
  maxDelay?: number; // in milliseconds
  factor?: number; // for exponential backoff
}

// Internal types
export interface Channel<T = any> {
  send(value: T): Promise<void>;
  receive(): Promise<T>;
  close(): void;
  isClosed(): boolean;
  length(): number;
  capacity(): number;
}

export interface WaitGroup {
  add(delta: number): void;
  done(): void;
  wait(): Promise<void>;
}

export interface Mutex {
  lock(): Promise<void>;
  unlock(): void;
  tryLock(): boolean;
}

export interface RWMutex {
  lock(): Promise<void>;
  unlock(): void;
  rLock(): Promise<void>;
  rUnlock(): void;
  tryLock(): boolean;
  tryRLock(): boolean;
}

export interface Once {
  do(fn: () => void | Promise<void>): Promise<void>;
}

export interface Cond {
  wait(mutex: Mutex): Promise<void>;
  signal(): void;
  broadcast(): void;
}

export interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
  tryAcquire(): boolean;
  availablePermits(): number;
}

export interface Context {
  done(): Promise<void>;
  err(): Error | null;
  deadline(): Date | null;
  value(key: string): any;
  cancel(): void;
}

export interface Ticker {
  channel(): Channel<Date>;
  stop(): void;
  reset(duration: number): void;
}

export interface Timer {
  channel(): Channel<Date>;
  stop(): boolean;
  reset(duration: number): boolean;
}

export interface WorkerPool {
  submit<T>(task: () => Promise<T>): Promise<T>;
  shutdown(): Promise<void>;
  isShutdown(): boolean;
}

export interface Pipeline<TInput, TOutput> {
  process(input: TInput): Promise<TOutput>;
  close(): void;
}

export interface RateLimiter {
  acquire(): Promise<void>;
  tryAcquire(): boolean;
  reset(): void;
}

export interface CircuitBreaker {
  call<T>(fn: () => Promise<T>): Promise<T>;
  getState(): 'closed' | 'open' | 'half-open';
  reset(): void;
}

export interface Retry {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  reset(): void;
} 