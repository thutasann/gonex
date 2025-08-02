// @ts-check
import {
  goAll,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../../dist/index.js';
import workerThreadTasks from '../../../utils/worker_thread_tasks.js';

console.log('2. Initializing Parallel Scheduler for Worker Threads:');
console.log('   - Enables true parallelism');
console.log('   - Uses multiple CPU cores');
console.log('   - Good for CPU-intensive tasks');
console.log('   - Requires initialization\n');

await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  loadBalancing: 'least-busy',
  sharedMemory: true,
  timeout: 30000,
});

console.log();

// Example 3: Worker Thread Execution (True parallelism)
console.log('3. Worker Thread Execution (True parallelism):');
console.log('   - Uses multiple worker threads');
console.log('   - True parallel execution');
console.log('   - Good for CPU-intensive tasks');
console.log('   - Requires initialization\n');

const startTime = Date.now();
const workerThreadResults = await goAll(workerThreadTasks, {
  useWorkerThreads: true,
  parallel: { threadCount: 4 },
});
const endTime = Date.now();

console.log('Worker Thread Results:', workerThreadResults);
console.log(`Total execution time: ${endTime - startTime}ms`);
console.log();

await shutdownParallelScheduler();
console.log('Shutdown complete!');
