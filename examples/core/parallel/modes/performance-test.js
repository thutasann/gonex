// @ts-check
import {
  goAll,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../../dist/index.js';
import heavyWorkerThreadTasks from '../../utils/heavy_worker_thread_tasks.js';

console.log('=== Performance Test: Optimized Worker Threads ===\n');

// Test 1: Native execution
console.log('1. Native Execution:');
const nativeStart = Date.now();
await Promise.all(heavyWorkerThreadTasks.map(task => task()));
const nativeTime = Date.now() - nativeStart;
console.log(`   Time: ${nativeTime}ms`);

// Test 2: Optimized Worker Threads
console.log('\n2. Optimized Worker Threads:');
await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  sharedMemory: true,
  timeout: 120000, // Increased timeout to 2 minutes
});

const workerStart = Date.now();
await goAll(heavyWorkerThreadTasks, [], {
  useWorkerThreads: true,
});
const workerTime = Date.now() - workerStart;
console.log(`   Time: ${workerTime}ms`);

await shutdownParallelScheduler();

console.table({
  'Native Execution': nativeTime,
  'Optimized Worker Threads': workerTime,
  Difference: workerTime - nativeTime,
  Performance: workerTime < nativeTime ? '✅ FASTER' : '❌ SLOWER',
  Speedup: ((nativeTime / workerTime) * 100).toFixed(1) + '% of native speed',
});
