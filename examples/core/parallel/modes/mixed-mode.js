import {
  go,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../../dist/index.js';

// Example 4: Mixed Execution Modes
console.log('4. Mixed Execution Modes:');
console.log('   - Lightweight tasks use event loop');
console.log('   - Heavy tasks use worker threads');
console.log('   - Best of both worlds\n');

await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  loadBalancing: 'least-busy',
  sharedMemory: true,
  timeout: 30000,
});

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

await shutdownParallelScheduler();
console.log('Shutdown complete!');
