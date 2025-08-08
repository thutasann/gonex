// @ts-check
/**
 * - Enabled true parallelism
 * - Uses multiple CPU cores
 * - Good for CPU-intensive tasks
 * - Requires initialization
 * - Multiple worker threads
 * - True parallel execution
 */
import {
  goAll,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../../dist/index.js';
import heavyWorkerThreadTasks from '../../../utils/heavy_worker_thread_tasks.js';

initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  sharedMemory: true,
  timeout: 30000,
}).then(async () => {
  const startTime = Date.now();
  const workerThreadResults = await goAll(heavyWorkerThreadTasks, [], {
    useWorkerThreads: true,
  });
  const endTime = Date.now();

  console.log('Worker Thread Results:', workerThreadResults);
  console.log(`Total execution time: ${endTime - startTime}ms`);
  console.log();

  await shutdownParallelScheduler();
});
