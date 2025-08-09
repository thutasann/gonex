// @ts-check
import { go, rwMutex, sleep } from '../../../dist/index.js';

console.log('=== RWMutex Example 4: Read-Write Coordination ===\n');

// Example 4: RWMutex demonstrating reader-writer coordination
const rwmtx4 = rwMutex();
let cache = new Map();
cache.set('user:1', { name: 'Alice', age: 30 });
cache.set('user:2', { name: 'Bob', age: 25 });

// Multiple readers accessing cache concurrently
for (let i = 1; i <= 3; i++) {
  go(async () => {
    await rwmtx4.rLock();
    try {
      console.log(`   Reader ${i} accessing cache...`);
      const user = cache.get(`user:${i <= 2 ? i : 1}`);
      console.log(`   Reader ${i} read: ${JSON.stringify(user)}`);
      await sleep(300); // Simulate processing
    } finally {
      rwmtx4.rUnlock();
      console.log(`   Reader ${i} finished`);
    }
  });
}

// Writer waiting for readers to finish
go(async () => {
  await sleep(100); // Let readers start
  console.log('   Writer waiting for exclusive access...');
  await rwmtx4.lock();
  try {
    console.log('   Writer got exclusive access, updating cache...');
    cache.set('user:3', { name: 'Charlie', age: 35 });
    cache.set('user:1', { name: 'Alice Updated', age: 31 });
    await sleep(400); // Simulate heavy write operation
    console.log('   Writer finished updating cache');
  } finally {
    rwmtx4.unlock();
    console.log('   Writer released exclusive lock');
  }
});

// Readers trying to access after writer starts waiting
for (let i = 4; i <= 5; i++) {
  go(async () => {
    await sleep(200); // Start after writer begins waiting
    console.log(`   Reader ${i} trying to access (should wait for writer)...`);
    await rwmtx4.rLock();
    try {
      const user = cache.get('user:1');
      console.log(`   Reader ${i} read updated data: ${JSON.stringify(user)}`);
    } finally {
      rwmtx4.rUnlock();
      console.log(`   Reader ${i} finished`);
    }
  });
}

// Final reader after all operations
go(async () => {
  await sleep(1000); // Wait for all operations to complete
  await rwmtx4.rLock();
  try {
    console.log('   Final Reader accessing final state:');
    for (const [key, value] of cache.entries()) {
      console.log(`     ${key}: ${JSON.stringify(value)}`);
    }
  } finally {
    rwmtx4.rUnlock();
    console.log('   Final Reader finished');
  }
});
