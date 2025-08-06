// @ts-check
import {
  go,
  goAll,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

async function testWorkerThreads() {
  console.log('Testing worker thread functionality...');

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Test 1: Simple function execution
    console.log('\n1. Testing simple function execution...');
    const result1 = await go(
      () => {
        console.log('Executing in worker thread');
        return 'Hello from worker thread!';
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Result:', result1);

    // Test 2: Function with arguments
    console.log('\n2. Testing function with arguments...');
    const result2 = await go(
      (a, b) => {
        console.log('Executing with arguments:', a, b);
        return a + b;
      },
      [5, 10],
      { useWorkerThreads: true }
    );
    console.log('Result:', result2);

    // Test 3: Heavy computation with arguments
    console.log('\n3. Testing heavy computation...');
    const result3 = await go(
      iterations => {
        console.log(
          'Starting heavy computation with',
          iterations,
          'iterations...'
        );
        let sum = 0;
        for (let i = 0; i < iterations; i++) {
          sum += Math.sqrt(i);
        }
        console.log('Heavy computation completed');
        return sum;
      },
      [100000],
      { useWorkerThreads: true }
    );
    console.log('Heavy computation result:', result3);

    // Test 4: Multiple concurrent executions
    console.log('\n4. Testing multiple concurrent executions...');
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        go(
          (workerId, iterations) => {
            console.log(`Worker ${workerId} starting...`);
            const start = Date.now();
            // Simulate some work
            let sum = 0;
            for (let j = 0; j < iterations; j++) {
              sum += Math.sqrt(j);
            }
            const duration = Date.now() - start;
            console.log(`Worker ${workerId} completed in ${duration}ms`);
            return { workerId, result: sum, duration };
          },
          [i, 50000],
          { useWorkerThreads: true }
        )
      );
    }

    const results = await Promise.all(promises);
    console.log('All workers completed:', results);

    // Test 5: Error handling
    console.log('\n5. Testing error handling...');
    try {
      await go(
        message => {
          throw new Error(`Test error from worker thread: ${message}`);
        },
        ['Hello Error'],
        { useWorkerThreads: true }
      );
    } catch (error) {
      console.log('Caught error:', error.message);
    }

    // Test 6: goAll with arguments
    console.log('\n6. Testing goAll with arguments...');
    const functions = [x => x * 2, x => x + 10, x => x * x];
    const args = [[5], [15], [3]];

    const goAllResults = await goAll(functions, args, {
      useWorkerThreads: true,
    });
    console.log('goAll results:', goAllResults);

    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

// Run the test
testWorkerThreads().catch(console.error);
