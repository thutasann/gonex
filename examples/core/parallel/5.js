// @ts-check
import { go } from '../../../dist/index.js';

// Example 5: Mixed single-threaded and parallel execution
console.log('5. Mixed execution modes:');

// Single-threaded goroutine
const singleThreadedResult = await go(() => {
  console.log('==> Single-threaded: Processing lightweight task...');
  return 'lightweight result';
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
  {
    useWorkerThreads: true,
    parallel: { threadCount: 2 },
  }
);

console.log('Single-threaded result:', singleThreadedResult);
console.log('Parallel result:', parallelResult);
