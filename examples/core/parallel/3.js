// @ts-check
import { goRace } from '../../../dist/index.js';
import sort_algorithms from '../../utils/sort_algos.js';

// Example 3: Race condition with parallel execution
console.log('3. Race condition with parallel execution:');

const fastestResult = await goRace(sort_algorithms, [], {
  useWorkerThreads: true,
});

console.log('Fastest algorithm result:', fastestResult);
console.log();
