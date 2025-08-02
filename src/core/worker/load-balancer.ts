import { Worker } from 'worker_threads';
import { WorkerHealth } from './worker-thread-manager';

/**
 * Load balancing strategies
 */
export type LoadBalancingStrategy = 'round-robin' | 'least-busy' | 'weighted';

/**
 * High-performance load balancer for worker threads
 *
 * Optimized for:
 * - Fast worker selection
 * - Minimal overhead
 * - Efficient load tracking
 */
export class LoadBalancer {
  private strategy: LoadBalancingStrategy;
  private currentIndex = 0;

  constructor(strategy: LoadBalancingStrategy = 'least-busy') {
    this.strategy = strategy;
  }

  /**
   * Select the best worker for the given load balancing strategy
   *
   * @param workers - Array of worker threads
   * @param health - Map of worker health data
   * @returns Selected worker thread
   */
  selectWorker(workers: Worker[], health: Map<number, WorkerHealth>): Worker {
    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(workers);
      case 'least-busy':
        return this.leastBusy(workers, health);
      case 'weighted':
        return this.weighted(workers, health);
      default:
        return this.leastBusy(workers, health);
    }
  }

  /**
   * Round-robin load balancing
   *
   * @param workers - Array of worker threads
   * @returns Selected worker
   */
  private roundRobin(workers: Worker[]): Worker {
    const worker = workers[this.currentIndex]!;
    this.currentIndex = (this.currentIndex + 1) % workers.length;
    return worker;
  }

  /**
   * Least-busy load balancing
   *
   * @param workers - Array of worker threads
   * @param health - Map of worker health data
   * @returns Selected worker
   */
  private leastBusy(
    workers: Worker[],
    health: Map<number, WorkerHealth>
  ): Worker {
    let bestWorker = workers[0]!;
    let lowestLoad = Infinity;

    for (let i = 0; i < workers.length; i++) {
      const workerHealth = health.get(i);
      if (workerHealth && workerHealth.isAlive) {
        if (workerHealth.load < lowestLoad) {
          lowestLoad = workerHealth.load;
          bestWorker = workers[i]!;
        }
      }
    }

    return bestWorker;
  }

  /**
   * Weighted load balancing
   *
   * @param workers - Array of worker threads
   * @param health - Map of worker health data
   * @returns Selected worker
   */
  private weighted(
    workers: Worker[],
    health: Map<number, WorkerHealth>
  ): Worker {
    const availableWorkers = workers.filter((_, index) => {
      const workerHealth = health.get(index);
      return workerHealth && workerHealth.isAlive;
    });

    if (availableWorkers.length === 0) {
      return workers[0]!; // Fallback
    }

    // Calculate total weight (inverse of load)
    let totalWeight = 0;
    const weights: number[] = [];

    for (let i = 0; i < workers.length; i++) {
      const workerHealth = health.get(i);
      if (workerHealth && workerHealth.isAlive) {
        const weight = Math.max(1, 100 - workerHealth.load);
        weights.push(weight);
        totalWeight += weight;
      } else {
        weights.push(0);
      }
    }

    // Select worker based on weight
    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (let i = 0; i < workers.length; i++) {
      currentWeight += weights[i] || 0;
      if (random <= currentWeight) {
        return workers[i]!;
      }
    }

    return workers[0]!; // Fallback
  }

  /**
   * Update worker load
   *
   * @param workerId - Worker ID
   * @param load - New load value
   * @param health - Map of worker health data
   */
  updateWorkerLoad(
    workerId: number,
    load: number,
    health: Map<number, WorkerHealth>
  ): void {
    const workerHealth = health.get(workerId);
    if (workerHealth) {
      workerHealth.load = load;
    }
  }
}
