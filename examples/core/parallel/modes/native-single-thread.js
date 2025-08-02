// @ts-check
/**
 * - Uses Node.js native single-threaded execution
 * - Good for I/O-bound tasks
 * - No initialization required
 */
import heavyWorkerThreadTasks from '../../../utils/heavy_worker_thread_tasks.js';
import runHeavyTasksSequentially from '../../../utils/run-heavy-sequentially.js';

const startTime = Date.now();

// Execute the same tasks in single-threaded mode using native promises
const eventLoopResults = await runHeavyTasksSequentially(
  heavyWorkerThreadTasks
);

const endTime = Date.now();

console.log('Native Single-Threaded Results:', eventLoopResults);
console.log(`Total execution time: ${endTime - startTime}ms`);
