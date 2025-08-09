/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  semaphore,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

// Example 6: Semaphore with worker threads
// Note: Semaphore operations in worker threads have limited synchronization guarantees
// This demonstrates the API but doesn't provide true cross-thread synchronization
const sem5 = semaphore({ permits: 1 });

async function semaphoreWorkerExample() {
  try {
    await initializeParallelScheduler({
      useWorkerThreads: true,
      threadCount: 2,
    });

    go(
      async semaphore => {
        await semaphore.acquire();
        console.log('   Worker 1 acquired semaphore');
        try {
          throw new Error('Resource error');
        } catch (error) {
          console.log(`   Worker 1 error: ${error.message}`);
        } finally {
          semaphore.release();
          console.log('   Worker 1 released semaphore in finally block');
        }
      },
      [sem5],
      { useWorkerThreads: true }
    );

    go(
      async semaphore => {
        const { sleep } = require('../../../dist/index.js');

        await sleep(100);
        await semaphore.acquire();
        console.log('   Worker 2 acquired semaphore after error');
        semaphore.release();
        console.log('   Worker 2 released semaphore');
      },
      [sem5],
      { useWorkerThreads: true }
    );

    console.log(
      '\nAll semaphore examples started. Waiting for completion...\n'
    );

    // Wait for the worker operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.error('Error in semaphoreWorkerExample:', error);
  } finally {
    await shutdownParallelScheduler();
  }
}

semaphoreWorkerExample().catch(console.error);
