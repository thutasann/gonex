// @ts-check
import { go, mutex, sleep } from '../../../dist/index.js';

// Example 5: Mutex with error handling
const mtx5 = mutex();

go(async () => {
  await mtx5.lock();
  console.log('   Worker 1 acquired lock');
  try {
    throw new Error('Something went wrong');
  } catch (error) {
    console.log(`   Worker 1 error: ${error.message}`);
  } finally {
    mtx5.unlock();
    console.log('   Worker 1 released lock in finally block');
  }
});

go(async () => {
  await sleep(100);
  await mtx5.lock();
  console.log('   Worker 2 acquired lock after error');
  mtx5.unlock();
  console.log('   Worker 2 released lock');
});

console.log('\nAll mutex examples started. Waiting for completion...\n');
