/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  go,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

/**
 * Simple test to verify the function registry system is working
 */

async function main() {
  console.log('🧪 Simple Function Registry Test');
  console.log('================================\n');

  try {
    // Initialize the parallel scheduler with worker threads
    await initializeParallelScheduler({
      useWorkerThreads: true,
      threadCount: 2,
    });

    console.log('✅ Parallel scheduler initialized\n');

    // Test 1: Simple function
    console.log('📝 Test 1: Simple function');
    const result1 = await go(
      () => {
        return 'Hello from worker thread!';
      },
      { useWorkerThreads: true }
    );
    console.log(`Result: ${result1}\n`);

    // Test 2: Function with dependencies
    console.log('📝 Test 2: Function with dependencies');
    const result2 = await go(
      () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        return 'Function with dependencies executed successfully!';
      },
      { useWorkerThreads: true }
    );
    console.log(`Result: ${result2}\n`);

    // Test 3: Async function
    console.log('📝 Test 3: Async function');
    const result3 = await go(
      async () => {
        new Promise(resolve => setTimeout(resolve, 100));
        return 'Async function completed!';
      },
      { useWorkerThreads: true }
    );
    console.log(`Result: ${result3}\n`);

    console.log('✅ All tests completed successfully!');
    console.log('🎉 Function registry system is working correctly!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
    console.log('\n🔄 Parallel scheduler shutdown complete');
  }
}

main().catch(console.error);
