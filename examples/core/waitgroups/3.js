// @ts-check
import { go, waitGroup, sleep } from '../../../dist/index.js';

// Example 3: WaitGroup with dynamic tasks
const wg3 = waitGroup();

// Simulate dynamic task creation
go(async () => {
  for (let i = 1; i <= 3; i++) {
    wg3.add(1);
    go(async () => {
      await sleep(100);
      console.log(`   Dynamic task ${i} completed`);
      wg3.done();
    });
    await sleep(50);
  }
});

wg3.wait().then(() => {
  console.log('   All dynamic tasks completed!');
});
