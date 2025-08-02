import { inspect } from 'util';

/**
 * Log levels for the logger
 */
export type LogLevel =
  | 'debug'
  | 'info'
  | 'success'
  | 'warn'
  | 'error'
  | 'fatal';

/**
 * Logger configuration options
 */
export type LoggerOptions = {
  /** Minimum log level to display */
  level?: LogLevel;
  /** Enable colored output */
  colors?: boolean;
  /** Enable timestamps */
  timestamps?: boolean;
  /** Enable stack traces for errors */
  stackTraces?: boolean;
  /** Custom prefix for log messages */
  prefix?: string;
  /** Enable debug mode */
  debug?: boolean;
};

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

/**
 * Log level configurations
 */
const logLevels: Record<
  LogLevel,
  { priority: number; color: keyof typeof colors; symbol: string }
> = {
  debug: { priority: 0, color: 'dim', symbol: '🔍 ' },
  info: { priority: 1, color: 'blue', symbol: 'ℹ️ ' },
  success: { priority: 2, color: 'green', symbol: '✅ ' },
  warn: { priority: 3, color: 'yellow', symbol: '⚠️ ' },
  error: { priority: 4, color: 'red', symbol: '❌ ' },
  fatal: { priority: 5, color: 'bgRed', symbol: '💀 ' },
};

/**
 * High-performance logger with color support and execution mode tracking
 *
 * Optimized for:
 * - Minimal performance impact
 * - Clear execution mode indication
 * - Comprehensive error tracking
 * - Beautiful colored output
 * - Stack trace support
 */
export class Logger {
  private options: Required<LoggerOptions>;
  private executionMode: 'event-loop' | 'worker-thread' = 'event-loop';

  constructor(options: LoggerOptions = {}) {
    this.options = {
      level: 'info',
      colors: true,
      timestamps: true,
      stackTraces: true,
      prefix: 'GONEX',
      debug: false,
      ...options,
    };
  }

  /**
   * Set the current execution mode
   */
  setExecutionMode(mode: 'event-loop' | 'worker-thread'): void {
    this.executionMode = mode;
  }

  /**
   * Get the current execution mode
   */
  getExecutionMode(): string {
    return this.executionMode;
  }

  /**
   * Format a log message with colors and metadata
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    data?: AnyValue
  ): string {
    const levelConfig = logLevels[level];
    const timestamp = this.options.timestamps
      ? `[${new Date().toISOString()}]`
      : '';
    const prefix = this.options.prefix ? `[${this.options.prefix}]` : '';
    const mode = `[${this.executionMode.toUpperCase()}]`;
    const symbol = levelConfig.symbol;

    let formattedMessage = `${timestamp} ${prefix} ${mode} ${symbol} ${message}`;

    if (data !== undefined) {
      const dataStr =
        typeof data === 'string'
          ? data
          : inspect(data, { depth: 3, colors: this.options.colors });
      formattedMessage += ` ${dataStr}`;
    }

    if (this.options.colors) {
      const color = colors[levelConfig.color];
      formattedMessage = `${color}${formattedMessage}${colors.reset}`;
    }

    return formattedMessage;
  }

  /**
   * Log a message if the level meets the minimum threshold
   */
  private log(
    level: LogLevel,
    message: string,
    data?: AnyValue,
    error?: Error
  ): void {
    if (logLevels[level].priority < logLevels[this.options.level].priority) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, data);
    console.log(formattedMessage);

    // Add stack trace for errors if enabled
    if (
      error &&
      this.options.stackTraces &&
      (level === 'error' || level === 'fatal')
    ) {
      console.log(`${colors.red}${error.stack}${colors.reset}`);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: AnyValue): void {
    this.log('debug', message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: AnyValue): void {
    this.log('info', message, data);
  }

  /**
   * Log a success message
   */
  success(message: string, data?: AnyValue): void {
    this.log('success', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: AnyValue): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, data?: AnyValue): void {
    this.log('error', message, data, error);
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error, data?: AnyValue): void {
    this.log('fatal', message, data, error);
  }

  /**
   * Log execution mode change
   */
  executionModeChange(from: string, to: string, reason?: string): void {
    const message = `Execution mode changed: ${from} → ${to}`;
    const data = reason ? { reason } : undefined;
    this.info(message, data);
  }

  /**
   * Log goroutine execution start
   */
  goroutineStart(name?: string, useWorkerThreads?: boolean): void {
    const mode = useWorkerThreads ? 'WORKER-THREAD' : 'EVENT-LOOP';
    const message = `Goroutine started${name ? `: ${name}` : ''}`;
    this.info(message, { mode, useWorkerThreads });
  }

  /**
   * Log goroutine execution completion
   */
  goroutineComplete(
    name?: string,
    duration?: number,
    useWorkerThreads?: boolean
  ): void {
    const mode = useWorkerThreads ? 'WORKER-THREAD' : 'EVENT-LOOP';
    const message = `Goroutine completed${name ? `: ${name}` : ''}`;
    this.success(message, {
      mode,
      duration: duration ? `${duration}ms` : undefined,
      useWorkerThreads,
    });
  }

  /**
   * Log worker thread operations
   */
  workerThread(message: string, data?: AnyValue): void {
    this.info(`Worker Thread: ${message}`, data);
  }

  /**
   * Log parallel scheduler operations
   */
  parallelScheduler(message: string, data?: AnyValue): void {
    this.info(`Parallel Scheduler: ${message}`, data);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, mode: string): void {
    this.info(`Performance: ${operation}`, { duration: `${duration}ms`, mode });
  }

  /**
   * Create a child logger with additional context
   */
  child(): Logger {
    const childLogger = new Logger(this.options);
    childLogger.setExecutionMode(this.executionMode || 'event-loop');
    return childLogger;
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger({
  level: 'info',
  colors: true,
  timestamps: true,
  stackTraces: true,
  prefix: 'GONEX',
});

/**
 * Convenience functions for quick logging
 */
export const log = {
  debug: (message: string, data?: AnyValue) => logger.debug(message, data),
  info: (message: string, data?: AnyValue) => logger.info(message, data),
  success: (message: string, data?: AnyValue) => logger.success(message, data),
  warn: (message: string, data?: AnyValue) => logger.warn(message, data),
  error: (message: string, error?: Error, data?: AnyValue) =>
    logger.error(message, error, data),
  fatal: (message: string, error?: Error, data?: AnyValue) =>
    logger.fatal(message, error, data),
  goroutine: {
    start: (name?: string, useWorkerThreads?: boolean) =>
      logger.goroutineStart(name, useWorkerThreads),
    complete: (name?: string, duration?: number, useWorkerThreads?: boolean) =>
      logger.goroutineComplete(name, duration, useWorkerThreads),
  },
  worker: (message: string, data?: AnyValue) =>
    logger.workerThread(message, data),
  parallel: (message: string, data?: AnyValue) =>
    logger.parallelScheduler(message, data),
  performance: (operation: string, duration: number, mode: string) =>
    logger.performance(operation, duration, mode),
};
