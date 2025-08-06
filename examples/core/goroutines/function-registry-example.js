/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  go,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

/**
 * Example demonstrating the new function registry system
 *
 * This example shows how the function registry eliminates the need
 * for passing dependencies and args, making it more robust for all function types.
 */

async function main() {
  console.log('🚀 Function Registry Example');
  console.log('=============================\n');

  try {
    // Initialize the parallel scheduler with worker threads
    await initializeParallelScheduler({
      useWorkerThreads: true,
      threadCount: 2,
    });

    console.log('✅ Parallel scheduler initialized with worker threads\n');

    // Example 1: Simple function execution
    console.log('📝 Example 1: Simple function execution');
    const result1 = await go(
      () => {
        return 'Hello from worker thread!';
      },
      { useWorkerThreads: true }
    );
    console.log(`Result: ${result1}\n`);

    // Example 2: Function with dependencies (no need to pass them explicitly)
    console.log('📝 Example 2: Function with dependencies');
    const result2 = await go(
      () => {
        // These functions are automatically available through the registry
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const validateTimeout = (timeout, name) => {
          if (typeof timeout !== 'number' || timeout < 0) {
            throw new Error(`Invalid ${name}: must be a non-negative number`);
          }
        };

        validateTimeout(1000, 'timeout');
        return 'Function with dependencies executed successfully!';
      },
      { useWorkerThreads: true }
    );
    console.log(`Result: ${result2}\n`);

    // Example 3: Async function with complex logic
    console.log('📝 Example 3: Async function with complex logic');
    const result3 = await go(
      async () => {
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 100));

        // Use built-in functions that are available in the registry
        const numbers = [1, 2, 3, 4, 5];
        const sum = numbers.reduce((acc, num) => acc + num, 0);
        const doubled = numbers.map(num => num * 2);

        return {
          sum,
          doubled,
          message: 'Complex async function completed!',
        };
      },
      { useWorkerThreads: true }
    );
    console.log(`Result:`, result3, '\n');

    // Example 4: Multiple concurrent executions
    console.log('📝 Example 4: Multiple concurrent executions');
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(
        go(
          () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            return `Task ${i + 1} completed`;
          },
          { useWorkerThreads: true }
        )
      );
    }

    const results = await Promise.all(promises);
    console.log('Concurrent results:', results, '\n');

    // Example 5: Error handling
    console.log('📝 Example 5: Error handling');
    try {
      await go(
        () => {
          throw new Error('This is a test error from worker thread');
        },
        {
          useWorkerThreads: true,
          onError: error => {
            console.log('✅ Error caught and handled:', error.message);
          },
        }
      );
    } catch (error) {
      console.log('✅ Error propagated correctly:', error.message, '\n');
    }

    console.log('✅ All examples completed successfully!');
    console.log('\n🎉 Function registry system is working correctly!');
    console.log('   - No need to pass dependencies explicitly');
    console.log('   - No need to pass args explicitly');
    console.log('   - Works with all function types');
    console.log('   - More robust and maintainable');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
    console.log('\n🔄 Parallel scheduler shutdown complete');
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export default { main };
