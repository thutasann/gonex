// @ts-check
import { getParallelScheduler } from '../../../dist/index.js';

// Example 4: Worker health monitoring
console.log('4. Worker health monitoring:');

const scheduler = getParallelScheduler();
if (scheduler) {
  const health = scheduler.getWorkerHealth();
  const activeWorkers = scheduler.getActiveWorkerCount();

  console.log(`Active workers: ${activeWorkers}`);
  if (health) {
    console.log('Worker health:', Object.fromEntries(health));
  }
}
