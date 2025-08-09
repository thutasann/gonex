/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  initializeParallelScheduler,
  mutex,
  shutdownParallelScheduler,
  sleep,
} from '../../../dist/index.js';

async function mutexWorkerExample() {
  try {
    // Note: Mutex operations require shared memory access and cannot work
    // across worker thread boundaries. This example runs in event loop mode.
    await initializeParallelScheduler({
      useWorkerThreads: true,
      threadCount: 1,
    });

    // Example 5: Mutex with error handling
    const mtx5 = mutex();

    go(
      async mtx5 => {
        await mtx5.lock();
        console.log('   Worker 1 acquired lock');
        try {
          throw new Error('Something went wrong');
        } catch (error) {
          console.log(`   Worker 1 error: ${error.message}`);
        } finally {
          mtx5.unlock();
          console.log('   Worker 1 released lock in finally block');
        }
      },
      [mtx5],
      { useWorkerThreads: true }
    );

    go(
      async mtx5 => {
        const { sleep } = require('../../../dist/index.js');

        await sleep(100);
        await mtx5.lock();
        console.log('   Worker 2 acquired lock after error');
        mtx5.unlock();
        console.log('   Worker 2 released lock');
      },
      [mtx5],
      { useWorkerThreads: true }
    );

    console.log('\nAll mutex examples started. Waiting for completion...\n');

    // Wait a bit for the operations to complete
    await sleep(1000);
  } catch (error) {
    console.error(error);
  } finally {
    await shutdownParallelScheduler();
  }
}

mutexWorkerExample().catch(console.error);
