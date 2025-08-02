// @ts-check
import { goAll, initializeParallelScheduler } from '../../dist/index.js';

console.log('=== Parallel Scheduler Example ===\n');

// Example 1: Initialize parallel scheduler
console.log('1. Initializing parallel scheduler:');
await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  loadBalancing: 'least-busy',
  sharedMemory: true,
  timeout: 30000,
});

console.log('Parallel scheduler initialized successfully!\n');

// Example 2: Heavy computation with true parallelism
console.log('2. Heavy computation with true parallelism:');

const computations = [
  () => {
    console.log('Starting computation 1...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Computation 1 completed with result:', result.toFixed(2));
    return { id: 1, result: result.toFixed(2) };
  },
  () => {
    console.log('Starting computation 2...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Computation 2 completed with result:', result.toFixed(2));
    return { id: 2, result: result.toFixed(2) };
  },
  () => {
    console.log('Starting computation 3...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Computation 3 completed with result:', result.toFixed(2));
    return { id: 3, result: result.toFixed(2) };
  },
  () => {
    console.log('Starting computation 4...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Computation 4 completed with result:', result.toFixed(2));
    return { id: 4, result: result.toFixed(2) };
  },
];

const startTime = Date.now();

const results = await goAll(computations, {
  useWorkerThreads: true,
  parallel: { threadCount: 4 },
});

const endTime = Date.now();
console.log(`All computations completed in ${endTime - startTime}ms`);
console.log('Results:', results);

// // Example 3: Race condition with parallel execution
// console.log('3. Race condition with parallel execution:');

// const searchAlgorithms = [
//   () => {
//     console.log('Algorithm 1: Starting linear search...');
//     // Simulate different search times
//     return new Promise(resolve => {
//       setTimeout(() => {
//         console.log('Algorithm 1: Found result in 200ms');
//         resolve({ algorithm: 'linear', time: 200, result: 'found' });
//       }, 200);
//     });
//   },
//   () => {
//     console.log('Algorithm 2: Starting binary search...');
//     return new Promise(resolve => {
//       setTimeout(() => {
//         console.log('Algorithm 2: Found result in 150ms');
//         resolve({ algorithm: 'binary', time: 150, result: 'found' });
//       }, 150);
//     });
//   },
//   () => {
//     console.log('Algorithm 3: Starting hash search...');
//     return new Promise(resolve => {
//       setTimeout(() => {
//         console.log('Algorithm 3: Found result in 100ms');
//         resolve({ algorithm: 'hash', time: 100, result: 'found' });
//       }, 100);
//     });
//   },
// ];

// const fastestResult = await goRace(searchAlgorithms, {
//   useWorkerThreads: true,
//   parallel: { threadCount: 3 },
// });

// console.log('Fastest algorithm result:', fastestResult);
// console.log();

// // Example 4: Worker health monitoring
// console.log('4. Worker health monitoring:');

// const scheduler = getParallelScheduler();
// if (scheduler) {
//   const health = scheduler.getWorkerHealth();
//   const activeWorkers = scheduler.getActiveWorkerCount();

//   console.log(`Active workers: ${activeWorkers}`);
//   if (health) {
//     console.log('Worker health:', Object.fromEntries(health));
//   }
// }
// console.log();

// // Example 5: Mixed single-threaded and parallel execution
// console.log('5. Mixed execution modes:');

// // Single-threaded goroutine
// const singleThreadedResult = await go(() => {
//   console.log('Single-threaded: Processing lightweight task...');
//   return 'lightweight result';
// });

// // Parallel goroutine
// const parallelResult = await go(
//   () => {
//     console.log('Parallel: Processing heavy task...');
//     let sum = 0;
//     for (let i = 0; i < 1000000; i++) {
//       sum += i;
//     }
//     return `heavy result: ${sum}`;
//   },
//   {
//     useWorkerThreads: true,
//     parallel: { threadCount: 2 },
//   }
// );

// console.log('Single-threaded result:', singleThreadedResult);
// console.log('Parallel result:', parallelResult);
// console.log();

// // Example 6: Shutdown parallel scheduler
// console.log('6. Shutting down parallel scheduler:');
// await shutdownParallelScheduler();
// console.log('Parallel scheduler shutdown complete!');

// console.log('\n=== Parallel Scheduler Example Complete ===');
