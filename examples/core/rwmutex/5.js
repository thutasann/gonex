// @ts-check
import { go, rwMutex, sleep } from '../../../dist/index.js';

console.log('=== RWMutex Example 5: Error Handling ===\n');

// Example 5: RWMutex with comprehensive error handling
const rwmtx5 = rwMutex({ name: 'error-demo-mutex' });

// Reader with error handling in finally block
go(async () => {
  await rwmtx5.rLock();
  console.log('   Reader 1 acquired read lock');
  try {
    await sleep(200);
    throw new Error('Reader processing error');
  } catch (error) {
    console.log(`   Reader 1 error: ${error.message}`);
  } finally {
    rwmtx5.rUnlock();
    console.log('   Reader 1 released read lock in finally block');
  }
});

// Writer with error handling
go(async () => {
  await sleep(100);
  await rwmtx5.lock();
  console.log('   Writer acquired write lock');
  try {
    await sleep(150);
    throw new Error('Writer processing error');
  } catch (error) {
    console.log(`   Writer error: ${error.message}`);
  } finally {
    rwmtx5.unlock();
    console.log('   Writer released write lock in finally block');
  }
});

// Demonstrating unlock without lock errors
go(async () => {
  await sleep(500);
  try {
    rwmtx5.rUnlock(); // Should throw error
  } catch (error) {
    console.log(`   Expected error - unlock without lock: ${error.message}`);
  }

  try {
    rwmtx5.unlock(); // Should throw error
  } catch (error) {
    console.log(
      `   Expected error - write unlock without lock: ${error.message}`
    );
  }
});

// Reader with timeout error handling
go(async () => {
  await sleep(600);
  await rwmtx5.lock(); // Hold write lock

  go(async () => {
    try {
      await rwmtx5.rLock(100); // Should timeout
      console.log('   Reader should not reach here');
      rwmtx5.rUnlock();
    } catch (error) {
      console.log(`   Reader timeout handled: ${error.name}`);
    }
  });

  await sleep(200);
  rwmtx5.unlock();
  console.log('   Long Writer released lock');
});

// Demonstrating max readers limit
go(async () => {
  await sleep(900);
  const limitedMutex = rwMutex({ maxReaders: 2, name: 'limited-mutex' });

  // Acquire 2 read locks
  limitedMutex.tryRLock();
  limitedMutex.tryRLock();
  console.log('   Acquired 2 read locks (at limit)');

  try {
    limitedMutex.tryRLock(); // Should throw error
  } catch (error) {
    console.log(`   Expected error - too many readers: ${error.name}`);
  }

  // Clean up
  limitedMutex.rUnlock();
  limitedMutex.rUnlock();
  console.log('   Released limited mutex locks');
});

console.log('\nAll RWMutex examples started. Waiting for completion...\n');
