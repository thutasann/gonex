// @ts-check
import { go, semaphore, sleep } from '../../../dist/index.js';

// Example 2: Semaphore with timeout
const sem2 = semaphore({ permits: 1 });

go(async () => {
  await sem2.acquire();
  console.log('   Worker 1 acquired semaphore');
  await sleep(500);
  sem2.release();
  console.log('   Worker 1 released semaphore');
});

go(async () => {
  try {
    await sem2.acquire(200); // 200ms timeout
    console.log('   Worker 2 acquired semaphore (should timeout)');
    sem2.release();
  } catch (error) {
    console.log(`   Worker 2 timeout: ${error.message}`);
  }
});
