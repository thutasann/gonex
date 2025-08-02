// @ts-check
import { goAll } from '../../../dist/index.js';
import heavy_computations from '../../utils/heavy_computations.js';

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
