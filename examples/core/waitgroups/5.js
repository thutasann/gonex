// @ts-check
import { go, waitGroup, sleep } from '../../../dist/index.js';

// Example 5: Nested WaitGroups
const outerWg = waitGroup();
const innerWg = waitGroup();

outerWg.add(1);
go(async () => {
  console.log('   Outer task started');

  // Inner tasks
  for (let i = 1; i <= 2; i++) {
    innerWg.add(1);
    go(async () => {
      await sleep(100);
      console.log(`   Inner task ${i} completed`);
      innerWg.done();
    });
  }

  await innerWg.wait();
  console.log('   All inner tasks completed');
  outerWg.done();
});

outerWg.wait().then(() => {
  console.log('   Outer task completed');
});

console.log('\nAll WaitGroup examples started. Waiting for completion...\n');
