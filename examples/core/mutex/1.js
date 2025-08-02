// @ts-check
import { go, mutex, sleep } from '../../../dist/index.js';

console.log('=== Mutex Example ===\n');

// Example 1: Basic mutex usage
const mtx1 = mutex();
let sharedCounter = 0;

for (let i = 1; i <= 3; i++) {
  go(async () => {
    await mtx1.lock();
    try {
      const current = sharedCounter;
      await sleep(100);
      sharedCounter = current + 1;
      console.log(`   Worker ${i} incremented counter to ${sharedCounter}`);
    } finally {
      mtx1.unlock();
    }
  });
}
