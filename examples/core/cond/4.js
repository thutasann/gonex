/* eslint-disable no-constant-condition */
// @ts-check
import { go, newCond, Mutex, sleep } from '../../../dist/index.js';

// Example 4: Proper signal() usage - single waiter queue
console.log('🔔 Example 4: Queue processing with signal()');

const items = [];
const mutex = new Mutex();
const cond = newCond(mutex, { name: 'queue-processor' });
let done = false;

// Producer adding items to queue
go(async () => {
  for (let i = 1; i <= 5; i++) {
    await sleep(300);

    await mutex.lock();
    items.push(`Item ${i}`);
    console.log(`   📤 Producer: Added ${items[items.length - 1]} to queue`);
    cond.signal(); // Wake up one waiting consumer
    mutex.unlock();
  }

  // Signal completion
  await sleep(100);
  await mutex.lock();
  done = true;
  console.log('   📤 Producer: All items added, signaling completion');
  cond.broadcast(); // Wake up all remaining consumers
  mutex.unlock();
});

// Consumer 1 - processes items
go(async () => {
  console.log('   📥 Consumer 1: Starting to process queue...');

  while (true) {
    await mutex.lock();

    while (items.length === 0 && !done) {
      console.log('   📥 Consumer 1: Queue empty, waiting...');
      await cond.wait();
    }

    if (items.length > 0) {
      const item = items.shift();
      console.log(`   📥 Consumer 1: Processing ${item}`);
      mutex.unlock();
      await sleep(200); // Simulate processing
    } else if (done) {
      console.log('   📥 Consumer 1: No more items, exiting');
      mutex.unlock();
      break;
    } else {
      mutex.unlock();
    }
  }
});

// Consumer 2 - also processes items
go(async () => {
  console.log('   📥 Consumer 2: Starting to process queue...');

  while (true) {
    await mutex.lock();

    while (items.length === 0 && !done) {
      console.log('   📥 Consumer 2: Queue empty, waiting...');
      await cond.wait();
    }

    if (items.length > 0) {
      const item = items.shift();
      console.log(`   📥 Consumer 2: Processing ${item}`);
      mutex.unlock();
      await sleep(250); // Simulate processing
    } else if (done) {
      console.log('   📥 Consumer 2: No more items, exiting');
      mutex.unlock();
      break;
    } else {
      mutex.unlock();
    }
  }
});
