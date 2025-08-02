// @ts-check
import { go, waitGroup, sleep } from '../../../dist/index.js';

// Example 2: WaitGroup with error handling
const wg2 = waitGroup();

for (let i = 1; i <= 3; i++) {
  wg2.add(1);
  go(async () => {
    try {
      if (i === 2) {
        throw new Error(`Worker ${i} failed`);
      }
      await sleep(50 * i);
      console.log(`   Worker ${i} completed successfully`);
    } catch (error) {
      console.log(`   Worker ${i} failed: ${error.message}`);
    } finally {
      wg2.done();
    }
  });
}

wg2.wait().then(() => {
  console.log('   All workers finished (some may have failed)');
});
