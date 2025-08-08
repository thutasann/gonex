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
 * 1. Initializes parallel scheduler with worker threads and 2 worker threads that check for cancellation
 */
async function testWorkerThreadContext() {
  console.log('=== Context Example 5: Worker Thread + Context ===\n');

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Test 1: Manual cancellation with worker threads
    console.log('1. Manual Cancellation with Worker Threads:');
    const [ctx1, cancel1] = withCancel(Background);

    go(
      async context => {
        const { sleep } = require('../../../../dist/index.js');
        try {
          console.log('   Starting work with context (worker thread)...');

          // Do work in small chunks to allow cancellation detection
          for (let i = 0; i < 10; i++) {
            await sleep(50);
            console.log(`   Working... step ${i + 1}`);

            // Check if context was cancelled
            const err = context.err();
            console.log(
              `   Context error at step ${i + 1}:`,
              err ? err.message : 'null'
            );

            if (err) {
              console.log(`   Work cancelled: ${err.message}`);
              return;
            }
          }

          console.log('   Work completed successfully!');
        } catch (error) {
          console.log(`   Work failed: ${error.message}`);
        }
      },
      [ctx1],
      { useWorkerThreads: true }
    );

    // Cancel the context after 200ms
    setTimeout(() => {
      console.log('   Cancelling context...');
      cancel1();
      console.log('   Context cancelled, error:', ctx1.err()?.message);
    }, 200);

    await sleep(600);

    console.log('\n✅ Worker thread context examples completed!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

testWorkerThreadContext().catch(console.error);
