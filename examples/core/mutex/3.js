// @ts-check
import { go, mutex, sleep } from '../../../dist/index.js';

// Example 3: Mutex with tryLock
const mtx3 = mutex();

go(async () => {
  await mtx3.lock();
  console.log('   Worker 1 acquired lock');
  await sleep(300);
  mtx3.unlock();
  console.log('   Worker 1 released lock');
});

go(async () => {
  const acquired = mtx3.tryLock();
  if (acquired) {
    console.log('   Worker 2 acquired lock immediately');
    mtx3.unlock();
  } else {
    console.log('   Worker 2 could not acquire lock immediately');
  }
});
