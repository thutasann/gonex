// @ts-check
import { go, sleep } from '../../../dist/index.js';

// Example 2: Multiple concurrent goroutines
console.log('\n2. Multiple concurrent goroutines:');
for (let i = 1; i <= 3; i++) {
  go(async () => {
    await sleep(100 * i);
    console.log(`   Goroutine ${i} completed after ${100 * i}ms`);
  });
}
