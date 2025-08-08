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
 * 4. Shows how context cancellation works across different execution modes
 */
async function testWorkerThreadContext() {
  console.log('=== Context Example 5: Worker Thread + Context ===\n');

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Test 4: Heavy computation with context cancellation
    console.log('\n4. Heavy Computation with Context Cancellation:');
    const [ctx4, cancel4] = withCancel(Background);

    go(
      async context => {
        try {
          console.log('   Starting heavy computation with context...');

          // Heavy computation that can be cancelled
          for (let i = 0; i < 20; i++) {
            // Simulate heavy work
            let sum = 0;
            for (let j = 0; j < 10000; j++) {
              sum += Math.sqrt(j);
            }

            console.log(
              `   Heavy computation... step ${i + 1}, sum: ${sum.toFixed(2)}`
            );

            // Check if context was cancelled
            const err = context.err();
            if (err) {
              console.log(`   Heavy computation cancelled: ${err.message}`);
              return;
            }
          }

          console.log('   Heavy computation completed successfully!');
        } catch (error) {
          console.log(`   Heavy computation failed: ${error.message}`);
        }
      },
      [ctx4],
      { useWorkerThreads: true }
    );

    // Cancel the context after 400ms
    setTimeout(() => {
      console.log('   Cancelling heavy computation...');
      cancel4();
      console.log(
        '   Heavy computation context cancelled, error:',
        ctx4.err()?.message
      );
    }, 400);

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
