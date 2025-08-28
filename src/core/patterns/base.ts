/**
 * Base Pattern - Abstract base class for all concurrency patterns
 * Provides common functionality for lifecycle management, error handling,
 * and metrics collection.
 */

import { logger } from '../../utils';
import { ErrorHandler, PatternConfig, PatternMetrics } from './types';

export abstract class BasePattern {
  protected config: Required<PatternConfig>;
  protected metrics: PatternMetrics;
  protected errorHandler: ErrorHandler;
  protected isRunningFlag: boolean = false;
  protected startTime: number = 0;

  constructor(config: Partial<PatternConfig>) {
    this.config = {
      name: 'unnamed-pattern',
      maxConcurrency: 10,
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      enableMetrics: true,
      errorHandler: this.defaultErrorHandler.bind(this),
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.errorHandler = this.config.errorHandler;
  }

  // Lifecycle management - abstract methods that must be implemented
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract isRunning(): boolean;

  // Protected helper methods for subclasses
  protected handleError(error: Error, context?: AnyValue): void {
    this.metrics.failedOperations++;
    this.errorHandler(error, context);

    if (this.config.enableMetrics) {
      logger.error(`Pattern ${this.config.name} error:`, error);
    }
  }

  protected async retry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await fn();
        this.metrics.successfulOperations++;
        return result;
      } catch (error) {
        lastError = error as Error;
        this.metrics.failedOperations++;

        if (attempt === this.config.retryAttempts) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  protected updateMetrics(duration: number): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalOperations++;
    this.metrics.averageDuration =
      (this.metrics.averageDuration * (this.metrics.totalOperations - 1) +
        duration) /
      this.metrics.totalOperations;
    this.metrics.lastOperationTime = Date.now();
  }

  protected setRunningState(running: boolean): void {
    this.isRunningFlag = running;
    if (running && this.startTime === 0) {
      this.startTime = Date.now();
    }
  }

  // Public methods for pattern management
  getName(): string {
    return this.config.name;
  }

  getMetrics(): PatternMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  getConfig(): Readonly<PatternConfig> {
    return { ...this.config };
  }

  // Private helper methods
  private defaultErrorHandler(error: Error, context?: AnyValue): void {
    logger.error(
      `Pattern ${this.config.name} encountered an error:`,
      new Error(`Pattern ${this.config.name} encountered an error:`),
      {
        error: error.message,
        stack: error.stack,
        context,
      }
    );
  }

  private initializeMetrics(): PatternMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      activeOperations: 0,
      peakConcurrency: 0,
      lastOperationTime: 0,
    };
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
