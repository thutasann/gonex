// @ts-check
import { go, waitGroup, sleep } from '../../dist/index.js';

console.log('=== WaitGroup Example ===\n');

// Example 1: Basic WaitGroup usage
console.log('1. Basic WaitGroup usage:');
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

// Example 2: WaitGroup with error handling
console.log('\n2. WaitGroup with error handling:');
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

// Example 3: WaitGroup with dynamic tasks
console.log('\n3. WaitGroup with dynamic tasks:');
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

// Example 4: WaitGroup timeout
console.log('\n4. WaitGroup with timeout:');
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

// Example 5: Nested WaitGroups
console.log('\n5. Nested WaitGroups:');
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
