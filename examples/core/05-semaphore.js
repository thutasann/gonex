// @ts-check
import { go, semaphore, sleep } from 'gonex';

console.log('=== Semaphore Example ===\n');

// Example 1: Basic semaphore usage
console.log('1. Basic semaphore usage:');
const sem1 = semaphore({ permits: 2 }); // Allow 2 concurrent access

for (let i = 1; i <= 4; i++) {
  go(async () => {
    await sem1.acquire();
    console.log(`   Worker ${i} acquired semaphore`);
    await sleep(200);
    console.log(`   Worker ${i} releasing semaphore`);
    sem1.release();
  });
}

// Example 2: Semaphore with timeout
console.log('\n2. Semaphore with timeout:');
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

// Example 3: Semaphore with tryAcquire
console.log('\n3. Semaphore with tryAcquire:');
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

// Example 4: Semaphore for resource pooling
console.log('\n4. Semaphore for resource pooling:');
const pool = semaphore({ permits: 3 }); // Pool of 3 resources
let activeConnections = 0;

async function useResource(id) {
  await pool.acquire();
  activeConnections++;
  console.log(`   Worker ${id} using resource (${activeConnections} active)`);

  try {
    await sleep(100 + Math.random() * 200);
    console.log(`   Worker ${id} finished with resource`);
  } finally {
    activeConnections--;
    pool.release();
    console.log(
      `   Worker ${id} released resource (${activeConnections} active)`
    );
  }
}

for (let i = 1; i <= 5; i++) {
  go(() => useResource(i));
}

// Example 5: Semaphore with error handling
console.log('\n5. Semaphore with error handling:');
const sem4 = semaphore({ permits: 1 });

go(async () => {
  await sem4.acquire();
  console.log('   Worker 1 acquired semaphore');
  try {
    throw new Error('Resource error');
  } catch (error) {
    console.log(`   Worker 1 error: ${error.message}`);
  } finally {
    sem4.release();
    console.log('   Worker 1 released semaphore in finally block');
  }
});

go(async () => {
  await sleep(100);
  await sem4.acquire();
  console.log('   Worker 2 acquired semaphore after error');
  sem4.release();
  console.log('   Worker 2 released semaphore');
});

console.log('\nAll semaphore examples started. Waiting for completion...\n');
