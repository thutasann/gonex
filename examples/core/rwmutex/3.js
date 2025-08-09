// @ts-check
import { go, rwMutex, sleep } from '../../../dist/index.js';

console.log('=== RWMutex Example 3: TryLock Operations ===\n');

// Example 3: RWMutex with tryLock
const rwmtx3 = rwMutex();

// First reader acquires lock
go(async () => {
  await rwmtx3.rLock();
  console.log('   Reader 1 acquired read lock');
  await sleep(500);
  rwmtx3.rUnlock();
  console.log('   Reader 1 released read lock');
});

// Second reader tries to acquire immediately
go(async () => {
  await sleep(100); // Let first reader start
  const readAcquired = rwmtx3.tryRLock();
  if (readAcquired) {
    console.log(
      '   Reader 2 acquired read lock immediately (concurrent with Reader 1)'
    );
    await sleep(200);
    rwmtx3.rUnlock();
    console.log('   Reader 2 released read lock');
  } else {
    console.log('   Reader 2 could not acquire read lock immediately');
  }
});

// Writer tries to acquire while readers are active
go(async () => {
  await sleep(200); // Let readers start
  const writeAcquired = rwmtx3.tryLock();
  if (writeAcquired) {
    console.log('   Writer acquired write lock immediately');
    await sleep(100);
    rwmtx3.unlock();
    console.log('   Writer released write lock');
  } else {
    console.log('   Writer could not acquire write lock (readers are active)');
  }
});

// Another writer tries after readers finish
go(async () => {
  await sleep(600); // Wait for readers to finish
  const writeAcquired = rwmtx3.tryLock();
  if (writeAcquired) {
    console.log('   Late Writer acquired write lock immediately');
    await sleep(200);
    rwmtx3.unlock();
    console.log('   Late Writer released write lock');
  } else {
    console.log('   Late Writer could not acquire write lock');
  }
});

// Reader tries after all operations
go(async () => {
  await sleep(900); // Wait for all others to finish
  const readAcquired = rwmtx3.tryRLock();
  if (readAcquired) {
    console.log('   Final Reader acquired read lock immediately');
    rwmtx3.rUnlock();
    console.log('   Final Reader released read lock');
  } else {
    console.log('   Final Reader could not acquire read lock');
  }
});
