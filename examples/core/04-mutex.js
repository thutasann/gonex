// @ts-check
import { go, mutex, sleep } from '../../dist/index.js';

console.log('=== Mutex Example ===\n');

// Example 1: Basic mutex usage
console.log('1. Basic mutex usage:');
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

// Example 2: Mutex with timeout
console.log('\n2. Mutex with timeout:');
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

// Example 3: Mutex with tryLock
console.log('\n3. Mutex with tryLock:');
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

// Example 4: Mutex with multiple resources
console.log('\n4. Mutex with multiple resources:');
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

// Example 5: Mutex with error handling
console.log('\n5. Mutex with error handling:');
const mtx4 = mutex();

go(async () => {
  await mtx4.lock();
  console.log('   Worker 1 acquired lock');
  try {
    throw new Error('Something went wrong');
  } catch (error) {
    console.log(`   Worker 1 error: ${error.message}`);
  } finally {
    mtx4.unlock();
    console.log('   Worker 1 released lock in finally block');
  }
});

go(async () => {
  await sleep(100);
  await mtx4.lock();
  console.log('   Worker 2 acquired lock after error');
  mtx4.unlock();
  console.log('   Worker 2 released lock');
});

console.log('\nAll mutex examples started. Waiting for completion...\n');
