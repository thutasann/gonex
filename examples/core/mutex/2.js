// @ts-check
import { go, mutex, sleep } from '../../../dist/index.js';

// Example 2: Mutex with timeout
const mtx2 = mutex();

go(async () => {
  await mtx2.lock();
  console.log('   Worker 1 acquired lock');
  await sleep(500);
  mtx2.unlock();
  console.log('   Worker 1 released lock');
});

go(async () => {
  try {
    await mtx2.lock(200); // 200ms timeout
    console.log('   Worker 2 acquired lock (should timeout)');
    mtx2.unlock();
  } catch (error) {
    console.log(`   Worker 2 timeout: ${error.message}`);
  }
});
