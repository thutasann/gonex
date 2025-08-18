// @ts-check
import {
  LockFreeQueue,
  MultiProducerQueue,
  PriorityQueue,
} from '../../../dist/index.js';

console.log('=== Shared Queues Example 4: Performance Comparison ===\n');

// Example 4: Performance comparison between different queue types
async function performanceComparison() {
  console.log('1. Performance comparison between queue types:');

  const testSizes = [1000, 10000, 100000];
  const iterations = 5;

  for (const size of testSizes) {
    console.log(`\n   Testing with ${size.toLocaleString()} items:`);

    // Test Lock-Free Queue
    console.log(`   - Lock-Free Queue:`);
    const lockFreeQueue = new LockFreeQueue(size);

    let totalTime = 0;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // Enqueue
      for (let j = 0; j < size; j++) {
        lockFreeQueue.enqueue(j);
      }

      // Dequeue
      while (!lockFreeQueue.isEmpty()) {
        lockFreeQueue.dequeue();
      }

      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime = totalTime / iterations;
    console.log(`     Average time: ${avgTime.toFixed(2)}ms`);
    lockFreeQueue.destroy();

    // Test Multi-Producer Queue
    console.log(`   - Multi-Producer Queue:`);
    const multiProducerQueue = new MultiProducerQueue(size);

    totalTime = 0;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // Enqueue (await async to avoid pending timers)
      for (let j = 0; j < size; j++) {
        await multiProducerQueue.enqueue(j);
      }

      // Dequeue (await async to avoid pending timers)
      while (!multiProducerQueue.isEmpty()) {
        await multiProducerQueue.dequeue();
      }

      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime2 = totalTime / iterations;
    console.log(`     Average time: ${avgTime2.toFixed(2)}ms`);
    multiProducerQueue.destroy();

    // Test Priority Queue
    console.log(`   - Priority Queue:`);
    const priorityQueue = new PriorityQueue(size);

    totalTime = 0;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // Enqueue
      for (let j = 0; j < size; j++) {
        priorityQueue.enqueueSync(j);
      }

      // Dequeue
      while (!priorityQueue.isEmpty()) {
        priorityQueue.dequeueSync();
      }

      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime3 = totalTime / iterations;
    console.log(`     Average time: ${avgTime3.toFixed(2)}ms`);
    priorityQueue.destroy();
  }

  console.log('\n2. Performance test completed');
  console.log(
    '   Note: Lock-Free Queue is fastest for single-threaded operations'
  );
  console.log(
    '   Multi-Producer Queue provides thread safety with moderate overhead'
  );
  console.log(
    '   Priority Queue has additional overhead due to heap maintenance'
  );
  setImmediate(() => process.exit(0));
}

// Run the example
performanceComparison().catch(console.error);
