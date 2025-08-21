/**
 * Core pattern types and interfaces for advanced concurrency patterns
 */

export type PatternConfig = {
  /** Unique name for the pattern */
  name: string;
  /** Maximum number of concurrent operations */
  maxConcurrency: number;
  /** Operation timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts for failed operations */
  retryAttempts: number;
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Custom error handler function */
  errorHandler: (error: Error) => void;
};

export type PatternMetrics = {
  /** Total operations processed */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Average operation duration in milliseconds */
  averageDuration: number;
  /** Current active operations */
  activeOperations: number;
  /** Peak concurrent operations */
  peakConcurrency: number;
  /** Last operation timestamp */
  lastOperationTime: number;
};

export type GlobalMetrics = {
  /** Total patterns registered */
  totalPatterns: number;
  /** Total operations across all patterns */
  totalOperations: number;
  /** System-wide error count */
  totalErrors: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Uptime in milliseconds */
  uptime: number;
};

export type ErrorHandler = (error: Error, context?: AnyValue) => void;

export type RetryContext = {
  /** Current attempt number */
  attempt: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** Error from previous attempt */
  lastError?: Error;
  /** Total time elapsed */
  totalTime: number;
};
