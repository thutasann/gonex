// @ts-check
import {
  goAll,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';
import heavyWorkerThreadTasks from '../../utils/heavy_worker_thread_tasks.js';

// === Event-loop execution (single-threaded) ===
const eventLoopStartTime = Date.now();
await goAll(heavyWorkerThreadTasks, [], {
  useWorkerThreads: false,
});
const eventLoopEndTime = Date.now();

// === Worker thread execution (multi-core) ===
const parallelStartTime = Date.now();
await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  sharedMemory: true,
  timeout: 30000,
});
await goAll(heavyWorkerThreadTasks, [], {
  useWorkerThreads: true,
});
const parallelEndTime = Date.now();

// === Shutdown ===
await shutdownParallelScheduler();

console.table({
  'Event loop execution time': eventLoopEndTime - eventLoopStartTime,
  'Parallel execution time': parallelEndTime - parallelStartTime,
});
