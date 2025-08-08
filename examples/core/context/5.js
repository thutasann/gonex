/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  Background,
  withCancel,
  withTimeout,
  initializeParallelScheduler,
  shutdownParallelScheduler,
  sleep,
} from '../../../dist/index.js';

/**
 * Context Example 5: Worker Thread + Context Cancellation
 *
 * This example demonstrates how context cancellation works with worker threads:
 * 1. Initializes parallel scheduler with worker threads
 * 2. Creates contexts with cancellation and timeout
 * 3. Runs goroutines in worker threads that check for cancellation
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
    // Test 1: Manual cancellation with worker threads
    console.log('1. Manual Cancellation with Worker Threads:');
    const [ctx1, cancel1] = withCancel(Background);

    go(
      async context => {
        const { sleep } = require('../../../dist/index.js');
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

    // Test 2: Timeout cancellation with worker threads
    console.log('\n2. Timeout Cancellation with Worker Threads:');
    const [ctx2] = withTimeout(Background, 300); // 300ms timeout

    go(
      async context => {
        const { sleep } = require('../../../dist/index.js');
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

    // Test 3: Multiple concurrent goroutines with shared context
    console.log('\n3. Multiple Concurrent Goroutines with Shared Context:');
    const [ctx3, cancel3] = withCancel(Background);

    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        go(
          async (workerId, context) => {
            const { sleep } = require('../../../dist/index.js');
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
