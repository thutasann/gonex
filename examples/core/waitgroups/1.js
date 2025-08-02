// @ts-check
import { go, waitGroup, sleep } from '../../../dist/index.js';

// Example 1: Basic WaitGroup usage
const wg1 = waitGroup();

for (let i = 1; i <= 3; i++) {
  wg1.add(1);
  go(async () => {
    await sleep(100 * i);
    console.log(`   Worker ${i} completed`);
    wg1.done();
  });
}

wg1.wait().then(() => {
  console.log('   All workers completed!');
});
