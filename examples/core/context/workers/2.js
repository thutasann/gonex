/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  Background,
  withTimeout,
  initializeParallelScheduler,
  shutdownParallelScheduler,
  sleep,
} from '../../../../dist/index.js';

/**
 * Context Example: Worker Thread + Context Cancellation
 *
 * This example demonstrates how context cancellation works with worker threads:
 * 2. Creates contexts with cancellation and timeout
 */
async function testWorkerThreadContext() {
  console.log('=== Context Example 5: Worker Thread + Context ===\n');

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    console.log('\n2. Timeout Cancellation with Worker Threads:');
    const [ctx2] = withTimeout(Background, 300); // 300ms timeout

    go(
      async context => {
        const { sleep } = require('../../../../dist/index.js');
        try {
          console.log(
            '   Starting work with timeout context (worker thread)...'
          );

          // Do work in small chunks to allow timeout detection
          for (let i = 0; i < 10; i++) {
            await sleep(50);
            console.log(`   Working... step ${i + 1}`);

            // Check if context was cancelled (timeout)
            const err = context.err();
            console.log(
              `   Context error at step ${i + 1}:`,
              err ? err.message : 'null'
            );

            if (err) {
              console.log(`   Work timed out: ${err.message}`);
              return;
            }
          }

          console.log('   Work completed successfully!');
        } catch (error) {
          console.log(`   Work failed: ${error.message}`);
        }
      },
      [ctx2],
      { useWorkerThreads: true }
    );

    console.log('   Context will timeout after 300ms');
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
