/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  Background,
  withCancel,
  initializeParallelScheduler,
  shutdownParallelScheduler,
  sleep,
} from '../../../../dist/index.js';

/**
 * Context Example: Worker Thread + Context Cancellation
 *
 * This example demonstrates how context cancellation works with worker threads:
 * 3. Runs goroutines in worker threads that check for cancellation
 */
async function testWorkerThreadContext() {
  console.log('=== Context Example 5: Worker Thread + Context ===\n');

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Test 3: Multiple concurrent goroutines with shared context
    console.log('\n3. Multiple Concurrent Goroutines with Shared Context:');
    const [ctx3, cancel3] = withCancel(Background);

    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        go(
          async (workerId, context) => {
            const { sleep } = require('../../../../dist/index.js');
            try {
              console.log(`   Worker ${workerId} starting...`);

              // Do work in small chunks
              for (let j = 0; j < 8; j++) {
                await sleep(50);
                console.log(`   Worker ${workerId}... step ${j + 1}`);

                // Check if context was cancelled
                const err = context.err();
                if (err) {
                  console.log(
                    `   Worker ${workerId} cancelled: ${err.message}`
                  );
                  return { workerId, status: 'cancelled', error: err.message };
                }
              }

              console.log(`   Worker ${workerId} completed successfully!`);
              return { workerId, status: 'completed' };
            } catch (error) {
              console.log(`   Worker ${workerId} failed: ${error.message}`);
              return { workerId, status: 'failed', error: error.message };
            }
          },
          [i, ctx3],
          { useWorkerThreads: true }
        )
      );
    }

    // Cancel the context after 300ms
    setTimeout(() => {
      console.log('   Cancelling shared context...');
      cancel3();
      console.log('   Shared context cancelled, error:', ctx3.err()?.message);
    }, 300);

    const results = await Promise.all(promises);
    console.log('   All workers results:', results);

    await sleep(800);

    console.log('\n✅ Worker thread context examples completed!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

testWorkerThreadContext().catch(console.error);
