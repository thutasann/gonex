// @ts-check
import { go, newCond, Mutex, sleep } from '../../../dist/index.js';

// Example 2: Broadcast to multiple waiters
console.log('🔔 Example 2: Broadcast to multiple waiters');

let count = 0;
const target = 3;
const mutex = new Mutex();
const cond = newCond(mutex);

// Multiple workers contributing to count
for (let i = 1; i <= 3; i++) {
  go(async () => {
    console.log(`   🔧 Worker ${i}: Starting work...`);
    await sleep(200 + i * 100); // Different work times

    await mutex.lock();
    count++;
    console.log(`   🔧 Worker ${i}: Completed work, count is now ${count}`);

    if (count >= target) {
      console.log(
        `   🔧 Worker ${i}: Target reached! Broadcasting to all waiters`
      );
      cond.broadcast(); // Wake up all waiting goroutines
    }
    mutex.unlock();
  });
}

// Multiple observers waiting for completion
for (let i = 1; i <= 2; i++) {
  go(async () => {
    console.log(`   👀 Observer ${i}: Waiting for all work to complete...`);

    await mutex.lock();
    while (count < target) {
      console.log(
        `   👀 Observer ${i}: Count is ${count}, waiting for ${target}...`
      );
      await cond.wait();
    }
    console.log(
      `   👀 Observer ${i}: All work completed! Final count: ${count}`
    );
    mutex.unlock();
  });
}
