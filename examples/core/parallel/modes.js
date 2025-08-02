// @ts-check
import {
  go,
  goAll,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

console.log('=== Execution Modes Demo ===\n');

// Example 1: Event Loop Execution (Single-threaded concurrency)
console.log('1. Event Loop Execution (Single-threaded concurrency):');
console.log('   - Uses Node.js event loop');
console.log('   - Non-blocking but single-threaded');
console.log('   - Good for I/O-bound tasks');
console.log('   - No initialization required\n');

const eventLoopTasks = [
  () => {
    console.log('Event Loop Task 1: Processing lightweight operation...');
    return new Promise(resolve => {
      setTimeout(() => resolve('Event Loop Result 1'), 100);
    });
  },
  () => {
    console.log('Event Loop Task 2: Processing lightweight operation...');
    return new Promise(resolve => {
      setTimeout(() => resolve('Event Loop Result 2'), 150);
    });
  },
  () => {
    console.log('Event Loop Task 3: Processing lightweight operation...');
    return new Promise(resolve => {
      setTimeout(() => resolve('Event Loop Result 3'), 200);
    });
  },
];

const eventLoopResults = await goAll(eventLoopTasks);
console.log('Event Loop Results:', eventLoopResults);
console.log();

// Example 2: Initialize Parallel Scheduler for Worker Threads
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

const workerThreadTasks = [
  () => {
    console.log('Worker Thread Task 1: Starting heavy computation...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Worker Thread Task 1: Heavy computation completed');
    return { task: 1, result: result.toFixed(2) };
  },
  () => {
    console.log('Worker Thread Task 2: Starting heavy computation...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Worker Thread Task 2: Heavy computation completed');
    return { task: 2, result: result.toFixed(2) };
  },
  () => {
    console.log('Worker Thread Task 3: Starting heavy computation...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Worker Thread Task 3: Heavy computation completed');
    return { task: 3, result: result.toFixed(2) };
  },
  () => {
    console.log('Worker Thread Task 4: Starting heavy computation...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Worker Thread Task 4: Heavy computation completed');
    return { task: 4, result: result.toFixed(2) };
  },
];

const startTime = Date.now();
const workerThreadResults = await goAll(workerThreadTasks, {
  useWorkerThreads: true,
  parallel: { threadCount: 4 },
});
const endTime = Date.now();

console.log('Worker Thread Results:', workerThreadResults);
console.log(`Total execution time: ${endTime - startTime}ms`);
console.log();

// Example 4: Mixed Execution Modes
console.log('4. Mixed Execution Modes:');
console.log('   - Lightweight tasks use event loop');
console.log('   - Heavy tasks use worker threads');
console.log('   - Best of both worlds\n');

// Lightweight task (event loop)
const lightweightResult = await go(() => {
  console.log('Lightweight Task: Processing simple operation...');
  return 'Lightweight result';
});

// Heavy task (worker thread)
const heavyResult = await go(
  () => {
    console.log('Heavy Task: Processing CPU-intensive operation...');
    let sum = 0;
    for (let i = 0; i < 500000; i++) {
      sum += Math.sqrt(i);
    }
    return `Heavy result: ${sum.toFixed(2)}`;
  },
  {
    useWorkerThreads: true,
    parallel: { threadCount: 2 },
  }
);

console.log('Mixed Results:', { lightweightResult, heavyResult });
console.log();

// Example 5: Performance Comparison
console.log('5. Performance Comparison:');
console.log('   - Event loop: Good for I/O, single-threaded');
console.log('   - Worker threads: Good for CPU, multi-threaded');
console.log('   - Choose based on task type\n');

// I/O-bound task (event loop is better)
const ioStartTime = Date.now();
const ioResults = await goAll([
  () => new Promise(resolve => setTimeout(() => resolve('IO 1'), 100)),
  () => new Promise(resolve => setTimeout(() => resolve('IO 2'), 100)),
  () => new Promise(resolve => setTimeout(() => resolve('IO 3'), 100)),
]);
const ioEndTime = Date.now();
console.log('I/O-bound tasks (Event Loop):', ioResults);
console.log(`I/O execution time: ${ioEndTime - ioStartTime}ms`);

// CPU-bound task (worker threads are better)
const cpuStartTime = Date.now();
const cpuResults = await goAll(
  [
    () => {
      let result = 0;
      for (let i = 0; i < 1000000; i++) result += i;
      return result;
    },
    () => {
      let result = 0;
      for (let i = 0; i < 1000000; i++) result += i;
      return result;
    },
    () => {
      let result = 0;
      for (let i = 0; i < 1000000; i++) result += i;
      return result;
    },
  ],
  { useWorkerThreads: true }
);
const cpuEndTime = Date.now();
console.log('CPU-bound tasks (Worker Threads):', cpuResults);
console.log(`CPU execution time: ${cpuEndTime - cpuStartTime}ms`);
console.log();

// Example 6: Shutdown
console.log('6. Shutting down parallel scheduler:');
await shutdownParallelScheduler();
console.log('Shutdown complete!');

console.log('\n=== Execution Modes Demo Complete ===');
console.log('\nSummary:');
console.log('✅ Event Loop: Single-threaded concurrency for I/O tasks');
console.log('✅ Worker Threads: True parallelism for CPU tasks');
console.log('✅ Mixed Mode: Use both based on task requirements');
console.log('✅ Clear Logging: Always know which mode is being used');
