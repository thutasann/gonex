// @ts-check
import { go, semaphore, sleep } from '../../../dist/index.js';

// Example 4: Semaphore for resource pooling
const pool = semaphore({ permits: 3 }); // Pool of 3 resources
let activeConnections = 0;

for (let i = 1; i <= 5; i++) {
  go(() => useResource(i));
}

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
