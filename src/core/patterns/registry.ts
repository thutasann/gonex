import { logger } from '../../utils/logger';
import { BasePattern } from './base';
import { GlobalMetrics } from './types';

/**
 * Pattern Registry - Central registry for managing all concurrency patterns
 * Provides global monitoring, metrics collection, and lifecycle management.
 */
export class PatternRegistry {
  private patterns: Map<string, BasePattern> = new Map();
  private globalMetrics: GlobalMetrics;
  private registryStartTime: number = Date.now();
  private isShuttingDown: boolean = false;

  constructor() {
    this.globalMetrics = this.initializeGlobalMetrics();
  }

  register(pattern: BasePattern): void {
    if (this.isShuttingDown) {
      throw new Error('Cannot register patterns during shutdown');
    }

    const name = pattern.getName();

    if (this.patterns.has(name)) {
      logger.warn(
        `Pattern ${name} is already registered, replacing existing pattern`
      );
    }

    this.patterns.set(name, pattern);
    this.globalMetrics.totalPatterns = this.patterns.size;

    logger.info(`Pattern ${name} registered successfully`);
  }

  unregister(name: string): boolean {
    const pattern = this.patterns.get(name);
    if (!pattern) {
      return false;
    }

    // Stop the pattern if it's running
    if (pattern.isRunning()) {
      pattern.stop().catch(error => {
        logger.error(`Error stopping pattern ${name}:`, error);
      });
    }

    const removed = this.patterns.delete(name);
    if (removed) {
      this.globalMetrics.totalPatterns = this.patterns.size;
      logger.info(`Pattern ${name} unregistered successfully`);
    }

    return removed;
  }

  getPattern(name: string): BasePattern | undefined {
    return this.patterns.get(name);
  }

  listPatterns(): string[] {
    return Array.from(this.patterns.keys());
  }

  async shutdownAll(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down all registered patterns...');

    const shutdownPromises = Array.from(this.patterns.values()).map(
      async pattern => {
        try {
          if (pattern.isRunning()) {
            await pattern.stop();
          }
        } catch (error) {
          logger.error(
            `Error shutting down pattern ${pattern.getName()}:`,
            new Error(`Error shutting down pattern ${pattern.getName()}:`)
          );
        }
      }
    );

    await Promise.allSettled(shutdownPromises);

    this.patterns.clear();
    this.globalMetrics.totalPatterns = 0;

    logger.info('All patterns shut down successfully');
  }

  getGlobalMetrics(): GlobalMetrics {
    // Update runtime metrics
    this.updateGlobalMetrics();
    return { ...this.globalMetrics };
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: AnyValue;
  } {
    const patterns = Array.from(this.patterns.values());
    const runningPatterns = patterns.filter(p => p.isRunning());
    const totalPatterns = patterns.length;

    if (totalPatterns === 0) {
      return {
        status: 'healthy',
        details: { message: 'No patterns registered' },
      };
    }

    const healthRatio = runningPatterns.length / totalPatterns;

    if (healthRatio === 1) {
      return {
        status: 'healthy',
        details: {
          runningPatterns: runningPatterns.length,
          totalPatterns,
        },
      };
    } else if (healthRatio >= 0.5) {
      return {
        status: 'degraded',
        details: {
          runningPatterns: runningPatterns.length,
          totalPatterns,
          stoppedPatterns: totalPatterns - runningPatterns.length,
        },
      };
    } else {
      return {
        status: 'unhealthy',
        details: {
          runningPatterns: runningPatterns.length,
          totalPatterns,
          stoppedPatterns: totalPatterns - runningPatterns.length,
        },
      };
    }
  }

  getPatternCount(): number {
    return this.patterns.size;
  }

  isShutdown(): boolean {
    return this.isShuttingDown;
  }

  private initializeGlobalMetrics(): GlobalMetrics {
    return {
      totalPatterns: 0,
      totalOperations: 0,
      totalErrors: 0,
      memoryUsage: 0,
      uptime: 0,
    };
  }

  private updateGlobalMetrics(): void {
    const patterns = Array.from(this.patterns.values());

    // Aggregate metrics from all patterns
    this.globalMetrics.totalOperations = patterns.reduce(
      (total, pattern) => total + pattern.getMetrics().totalOperations,
      0
    );

    this.globalMetrics.totalErrors = patterns.reduce(
      (total, pattern) => total + pattern.getMetrics().failedOperations,
      0
    );

    this.globalMetrics.uptime = Date.now() - this.registryStartTime;

    // Estimate memory usage (rough calculation)
    this.globalMetrics.memoryUsage = patterns.length * 1024; // 1KB per pattern estimate
  }
}

export const globalPatternRegistry = new PatternRegistry();
