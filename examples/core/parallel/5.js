// @ts-check
import {
  go,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

// Example 5: Mixed single-threaded and parallel execution
console.log('5. Mixed execution modes:');

// Single-threaded goroutine
const singleThreadedResult = await go(() => {
  console.log('==> Single-threaded: Processing lightweight task...');
  return 'lightweight result';
});

await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  sharedMemory: true,
  timeout: 30000,
});

// Parallel goroutine
const parallelResult = await go(
  () => {
    console.log('==> Parallel: Processing heavy task...');
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += i;
    }
    return `heavy result: ${sum}`;
  },
  [],
  {
    useWorkerThreads: true,
  }
);

console.log('Single-threaded result:', singleThreadedResult);
console.log('Parallel result:', parallelResult);

await shutdownParallelScheduler();
