// @ts-check
import {
  initializeParallelScheduler,
  shutdownParallelScheduler,
  sleep,
} from '../../../dist/index.js';

console.log('=== Parallel Scheduler Example ===\n');

// Example 1: Initialize parallel scheduler
await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  sharedMemory: true,
  timeout: 30000,
});

await sleep(500);

await shutdownParallelScheduler();

console.log('Parallel scheduler initialized successfully!\n');
