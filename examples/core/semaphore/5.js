// @ts-check
import { go, semaphore, sleep } from '../../../dist/index.js';

// Example 5: Semaphore with error handling
const sem5 = semaphore({ permits: 1 });

go(async () => {
  await sem5.acquire();
  console.log('   Worker 1 acquired semaphore');
  try {
    throw new Error('Resource error');
  } catch (error) {
    console.log(`   Worker 1 error: ${error.message}`);
  } finally {
    sem5.release();
    console.log('   Worker 1 released semaphore in finally block');
  }
});

go(async () => {
  await sleep(100);
  await sem5.acquire();
  console.log('   Worker 2 acquired semaphore after error');
  sem5.release();
  console.log('   Worker 2 released semaphore');
});

console.log('\nAll semaphore examples started. Waiting for completion...\n');
