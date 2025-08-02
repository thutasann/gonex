// @ts-check
import { go, semaphore, sleep } from '../../../dist/index.js';

console.log('=== Semaphore Example ===\n');

// Example 1: Basic semaphore usage
const sem1 = semaphore({ permits: 2 }); // Allow 2 concurrent access

for (let i = 1; i <= 4; i++) {
  go(async () => {
    await sem1.acquire();
    console.log(`   Worker ${i} acquired semaphore`);
    await sleep(200);
    console.log(`   Worker ${i} releasing semaphore`);
    sem1.release();
  });
}
