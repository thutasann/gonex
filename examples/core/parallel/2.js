// @ts-check
import { goAll, initializeParallelScheduler } from '../../../dist/index.js';
import heavy_computations from '../../utils/heavy_computations.js';

await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  loadBalancing: 'least-busy',
  sharedMemory: true,
  timeout: 30000,
});

// Example 2: Heavy computation with true parallelism
console.log('2. Heavy computation with true parallelism:');

const startTime = Date.now();

const results = await goAll(heavy_computations, {
  useWorkerThreads: true,
  parallel: { threadCount: 4 },
});

const endTime = Date.now();
console.log(`All computations completed in ${endTime - startTime}ms`);
console.log('Results:', results);
