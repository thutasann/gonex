// @ts-check
import { go, semaphore, sleep } from '../../../dist/index.js';

// Example 3: Semaphore with tryAcquire
const sem3 = semaphore({ permits: 1 });

go(async () => {
  await sem3.acquire();
  console.log('   Worker 1 acquired semaphore');
  await sleep(300);
  sem3.release();
  console.log('   Worker 1 released semaphore');
});

go(async () => {
  const acquired = sem3.tryAcquire();
  if (acquired) {
    console.log('   Worker 2 acquired semaphore immediately');
    sem3.release();
  } else {
    console.log('   Worker 2 could not acquire semaphore immediately');
  }
});
