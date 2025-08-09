// @ts-check
import { go, rwMutex, sleep } from '../../../dist/index.js';

console.log('=== RWMutex Example 1: Multiple Concurrent Readers ===\n');

// Example 1: Basic RWMutex usage with multiple readers
const rwmtx1 = rwMutex();
let sharedData = { value: 42, timestamp: Date.now() };

// Multiple readers can access simultaneously
for (let i = 1; i <= 5; i++) {
  go(async () => {
    await rwmtx1.rLock();
    try {
      console.log(
        `   Reader ${i} reading: value=${sharedData.value}, timestamp=${sharedData.timestamp}`
      );
      await sleep(200); // Simulate read operation
      console.log(`   Reader ${i} finished reading`);
    } finally {
      rwmtx1.rUnlock();
    }
  });
}

// Single writer updates the data
go(async () => {
  await sleep(100); // Let readers start first
  await rwmtx1.lock();
  try {
    console.log('   Writer updating shared data...');
    sharedData = { value: sharedData.value * 2, timestamp: Date.now() };
    await sleep(300); // Simulate write operation
    console.log(`   Writer finished: new value=${sharedData.value}`);
  } finally {
    rwmtx1.unlock();
  }
});
