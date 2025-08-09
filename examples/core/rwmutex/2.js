// @ts-check
import { go, rwMutex, sleep } from '../../../dist/index.js';

console.log('=== RWMutex Example 2: Timeout Scenarios ===\n');

// Example 2: RWMutex with timeout
const rwmtx2 = rwMutex();

// Long-running writer holds the lock
go(async () => {
  await rwmtx2.lock();
  console.log('   Long Writer acquired lock');
  await sleep(1000); // Hold lock for 1 second
  rwmtx2.unlock();
  console.log('   Long Writer released lock');
});

// Reader tries to acquire with timeout
go(async () => {
  await sleep(100); // Let writer start first
  try {
    await rwmtx2.rLock(500); // 500ms timeout
    console.log('   Reader acquired lock (should timeout)');
    rwmtx2.rUnlock();
  } catch (error) {
    console.log(`   Reader timeout: ${error.message}`);
  }
});

// Writer tries to acquire with timeout
go(async () => {
  await sleep(200); // Let first writer start
  try {
    await rwmtx2.lock(300); // 300ms timeout
    console.log('   Second Writer acquired lock (should timeout)');
    rwmtx2.unlock();
  } catch (error) {
    console.log(`   Second Writer timeout: ${error.message}`);
  }
});

// Reader that succeeds after timeout
go(async () => {
  await sleep(1200); // Wait for long writer to finish
  await rwmtx2.rLock(200); // Short timeout, but should succeed
  console.log('   Late Reader acquired lock successfully');
  rwmtx2.rUnlock();
  console.log('   Late Reader released lock');
});
