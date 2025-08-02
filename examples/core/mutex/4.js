// @ts-check
import { go, mutex, sleep } from '../../../dist/index.js';

// Example 4: Mutex with multiple resources
const resource1 = mutex();
const resource2 = mutex();

go(async () => {
  await resource1.lock();
  console.log('   Worker 1 acquired resource 1');
  await sleep(200);
  await resource2.lock();
  console.log('   Worker 1 acquired resource 2');
  await sleep(100);
  resource2.unlock();
  resource1.unlock();
  console.log('   Worker 1 released both resources');
});

go(async () => {
  await resource1.lock();
  console.log('   Worker 2 acquired resource 1');
  await sleep(100);
  await resource2.lock();
  console.log('   Worker 2 acquired resource 2');
  await sleep(100);
  resource2.unlock();
  resource1.unlock();
  console.log('   Worker 2 released both resources');
});
