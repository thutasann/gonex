// @ts-check
import { go, waitGroup, sleep } from '../../../dist/index.js';

// Example 4: WaitGroup timeout
const wg4 = waitGroup();

for (let i = 1; i <= 5; i++) {
  wg4.add(1);
  go(async () => {
    await sleep(200 * i);
    console.log(`   Long task ${i} completed`);
    wg4.done();
  });
}

// Wait with timeout
Promise.race([
  wg4.wait(),
  sleep(1000).then(() => {
    throw new Error('WaitGroup timeout');
  }),
])
  .then(() => {
    console.log('   All tasks completed within timeout');
  })
  .catch(error => {
    console.log(`   Timeout: ${error.message}`);
  });
