/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  Background,
  withCancel,
  withTimeout,
  withValue,
  initializeParallelScheduler,
  shutdownParallelScheduler,
  sleep,
} from '../../../../dist/index.js';

/**
 * Context Example 5: Worker Thread + Context with Values
 *
 * This example demonstrates how context values work with worker threads:
 * 1. Initializes parallel scheduler with worker threads
 * 2. Creates contexts with values using withValue
 * 3. Shows how context values are accessible in worker threads
 * 4. Demonstrates context value inheritance and updates
 * 5. Shows context cancellation with values
 */
async function testWorkerThreadContextWithValues() {
  console.log(
    '=== Context Example 5: Worker Thread + Context with Values ===\n'
  );

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Test 1: Basic context values with worker threads
    console.log('1. Basic Context Values with Worker Threads:');
    const ctx1 = withValue(Background, 'user', { id: 123, name: 'John Doe' });
    const ctx2 = withValue(ctx1, 'requestId', 'req-456');
    const ctx3 = withValue(ctx2, 'session', {
      token: 'abc123',
      expires: Date.now() + 3600000,
    });

    go(
      async context => {
        const { sleep } = require('../../../../dist/index.js');
        try {
          console.log(
            '   Starting work with context values (worker thread)...'
          );

          // Access context values
          const user = context.value('user');
          const requestId = context.value('requestId');
          const session = context.value('session');

          console.log('   Context values in worker thread:');
          console.log(`     User: ${JSON.stringify(user)}`);
          console.log(`     Request ID: ${requestId}`);
          console.log(`     Session: ${JSON.stringify(session)}`);

          // Do work with context values
          for (let i = 0; i < 5; i++) {
            await sleep(100);
            console.log(`   Working... step ${i + 1} for user ${user?.name}`);

            // Check if context was cancelled
            const err = context.err();
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
      [ctx3],
      { useWorkerThreads: true }
    );

    await sleep(800);

    // Test 2: Context value inheritance and updates
    console.log('\n2. Context Value Inheritance and Updates:');
    const baseCtx = withValue(Background, 'environment', 'production');
    const userCtx = withValue(baseCtx, 'userId', 789);
    const [cancellableCtx, cancelCtx] = withCancel(userCtx);

    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        go(
          async (workerId, context) => {
            const { sleep } = require('../../../../dist/index.js');
            try {
              console.log(`   Worker ${workerId} starting...`);

              // Access inherited context values
              const environment = context.value('environment');
              const userId = context.value('userId');

              console.log(`   Worker ${workerId} context values:`);
              console.log(`     Environment: ${environment}`);
              console.log(`     User ID: ${userId}`);

              // Do work in small chunks
              for (let j = 0; j < 6; j++) {
                await sleep(80);
                console.log(
                  `   Worker ${workerId}... step ${j + 1} (env: ${environment})`
                );

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
              return { workerId, status: 'completed', environment, userId };
            } catch (error) {
              console.log(`   Worker ${workerId} failed: ${error.message}`);
              return { workerId, status: 'failed', error: error.message };
            }
          },
          [i, cancellableCtx],
          { useWorkerThreads: true }
        )
      );
    }

    // Cancel the context after 400ms
    setTimeout(() => {
      console.log('   Cancelling context with values...');
      cancelCtx();
      console.log(
        '   Context cancelled, error:',
        cancellableCtx.err()?.message
      );
    }, 400);

    const results = await Promise.all(promises);
    console.log('   All workers results:', results);

    // Test 3: Complex context values with functions and objects
    console.log('\n3. Complex Context Values with Functions and Objects:');
    const configCtx = withValue(Background, 'config', {
      apiUrl: 'https://api.example.com',
      timeout: 5000,
      retries: 3,
      headers: { 'Content-Type': 'application/json' },
    });

    const authCtx = withValue(configCtx, 'auth', {
      token: 'bearer-xyz789',
      permissions: ['read', 'write', 'delete'],
      roles: ['user', 'admin'],
    });

    const [timeoutCtx] = withTimeout(authCtx, 600);

    go(
      async context => {
        const { sleep } = require('../../../../dist/index.js');
        try {
          console.log('   Starting complex work with context values...');

          // Access complex context values
          const config = context.value('config');
          const auth = context.value('auth');

          console.log('   Complex context values in worker thread:');
          console.log(`     Config: ${JSON.stringify(config)}`);
          console.log(`     Auth: ${JSON.stringify(auth)}`);

          // Simulate API calls using context values
          for (let i = 0; i < 8; i++) {
            await sleep(70);
            console.log(
              `   API call ${i + 1} to ${config?.apiUrl} with token ${auth?.token?.substring(0, 10)}...`
            );

            // Check if context was cancelled (timeout)
            const err = context.err();
            if (err) {
              console.log(`   Work timed out: ${err.message}`);
              return;
            }
          }

          console.log('   Complex work completed successfully!');
        } catch (error) {
          console.log(`   Complex work failed: ${error.message}`);
        }
      },
      [timeoutCtx],
      { useWorkerThreads: true }
    );

    console.log('   Context will timeout after 600ms');
    await sleep(800);

    // Test 4: Context value updates and dynamic behavior
    console.log('\n4. Context Value Updates and Dynamic Behavior:');
    const [dynamicCtx, cancelDynamic] = withCancel(Background);

    // Create context with dynamic values
    const dynamicValueCtx = withValue(dynamicCtx, 'counter', 0);
    const dynamicUserCtx = withValue(dynamicValueCtx, 'user', {
      name: 'Alice',
      status: 'active',
    });

    go(
      async context => {
        const { sleep } = require('../../../../dist/index.js');
        try {
          console.log('   Starting dynamic work with context values...');

          // Access initial context values
          let counter = context.value('counter');
          let user = context.value('user');

          console.log(
            `   Initial values - Counter: ${counter}, User: ${JSON.stringify(user)}`
          );

          // Simulate work that might update context values
          for (let i = 0; i < 10; i++) {
            await sleep(50);

            // Re-read context values (they might have changed)
            counter = context.value('counter');
            user = context.value('user');

            console.log(
              `   Step ${i + 1} - Counter: ${counter}, User status: ${user?.status}`
            );

            // Check if context was cancelled
            const err = context.err();
            if (err) {
              console.log(`   Dynamic work cancelled: ${err.message}`);
              return;
            }
          }

          console.log('   Dynamic work completed successfully!');
        } catch (error) {
          console.log(`   Dynamic work failed: ${error.message}`);
        }
      },
      [dynamicUserCtx],
      { useWorkerThreads: true }
    );

    // Cancel the context after 300ms
    setTimeout(() => {
      console.log('   Cancelling dynamic context...');
      cancelDynamic();
      console.log(
        '   Dynamic context cancelled, error:',
        dynamicCtx.err()?.message
      );
    }, 300);

    await sleep(600);

    // Test 5: Nested context values with multiple levels
    console.log('\n5. Nested Context Values with Multiple Levels:');
    const level1 = withValue(Background, 'level', 1);
    const level2 = withValue(level1, 'level', 2);
    const level3 = withValue(level2, 'level', 3);
    const level4 = withValue(level3, 'level', 4);
    const finalCtx = withValue(level4, 'final', true);

    go(
      async context => {
        const { sleep } = require('../../../../dist/index.js');
        try {
          console.log('   Starting nested context work...');

          // Access nested context values
          const level = context.value('level');
          const final = context.value('final');

          console.log(
            `   Nested context values - Level: ${level}, Final: ${final}`
          );

          // Demonstrate context value lookup behavior
          for (let i = 0; i < 5; i++) {
            await sleep(100);
            console.log(`   Nested work step ${i + 1} at level ${level}`);

            // Check if context was cancelled
            const err = context.err();
            if (err) {
              console.log(`   Nested work cancelled: ${err.message}`);
              return;
            }
          }

          console.log('   Nested work completed successfully!');
        } catch (error) {
          console.log(`   Nested work failed: ${error.message}`);
        }
      },
      [finalCtx],
      { useWorkerThreads: true }
    );

    await sleep(800);

    console.log('\n✅ Worker thread context with values examples completed!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

testWorkerThreadContextWithValues().catch(console.error);
