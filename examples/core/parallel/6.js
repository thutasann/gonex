// @ts-check
import { shutdownParallelScheduler } from '../../../dist/index.js';

// Example 6: Shutdown parallel scheduler
console.log('6. Shutting down parallel scheduler:');
await shutdownParallelScheduler();
console.log('Parallel scheduler shutdown complete!');

console.log('\n=== Parallel Scheduler Example Complete ===');
