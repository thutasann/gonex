// @ts-check
import {
  goAll,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../../dist/index.js';

await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  loadBalancing: 'least-busy',
  sharedMemory: true,
  timeout: 30000,
});

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
await shutdownParallelScheduler();
console.log('Shutdown complete!');

console.log('\n=== Execution Modes Demo Complete ===');
console.log('\nSummary:');
console.log('✅ Event Loop: Single-threaded concurrency for I/O tasks');
console.log('✅ Worker Threads: True parallelism for CPU tasks');
console.log('✅ Mixed Mode: Use both based on task requirements');
console.log('✅ Clear Logging: Always know which mode is being used');
