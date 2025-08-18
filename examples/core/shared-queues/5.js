// @ts-check
import {
  LockFreeQueue,
  MultiProducerQueue,
  PriorityQueue,
} from '../../../dist/index.js';

console.log('=== Shared Queues Example 5: Advanced Patterns ===\n');

// Example 5: Advanced queue patterns and combinations
async function advancedPatterns() {
  console.log('1. Producer-Consumer pattern with multiple queues:');

  // Create different types of queues for different purposes
  const highPriorityQueue = new PriorityQueue(100);
  const normalQueue = new MultiProducerQueue(200);
  const lowPriorityQueue = new LockFreeQueue(300);

  console.log('   Created three queues with different priorities and types');

  // Simulate different types of work
  console.log('\n2. Simulating different types of work:');

  const workItems = [
    { type: 'high', data: 'Critical system update', priority: 15 },
    { type: 'normal', data: 'Regular data processing', priority: 5 },
    { type: 'low', data: 'Background cleanup', priority: 1 },
    { type: 'high', data: 'Security alert', priority: 20 },
    { type: 'normal', data: 'User request', priority: 3 },
    { type: 'low', data: 'Log rotation', priority: 2 },
  ];

  for (const item of workItems) {
    let success = false;

    switch (item.type) {
      case 'high':
        success = highPriorityQueue.enqueueSync({
          type: item.type,
          data: item.data,
        });
        break;
      case 'normal':
        success = await normalQueue.enqueue({
          type: item.type,
          data: item.data,
        });
        break;
      case 'low':
        success = lowPriorityQueue.enqueue({
          type: item.type,
          data: item.data,
        });
        break;
    }

    console.log(
      `   Enqueued ${item.type} priority: "${item.data}" - ${success ? 'Success' : 'Failed'}`
    );
  }

  // Process work in priority order
  console.log('\n3. Processing work in priority order:');

  let processedCount = 0;
  const maxItems = 10;

  while (processedCount < maxItems) {
    // First, check high priority queue
    let item = highPriorityQueue.dequeueSync();
    if (item) {
      console.log(`   [HIGH] Processing: ${item.data}`);
      processedCount++;
      continue;
    }

    // Then, check normal priority queue
    item = normalQueue.dequeue();
    if (item) {
      console.log(`   [NORMAL] Processing: ${item.data}`);
      processedCount++;
      continue;
    }

    // Finally, check low priority queue
    item = lowPriorityQueue.dequeue();
    if (item) {
      console.log(`   [LOW] Processing: ${item.data}`);
      processedCount++;
      continue;
    }

    // If all queues are empty, break
    if (
      highPriorityQueue.isEmpty() &&
      normalQueue.isEmpty() &&
      lowPriorityQueue.isEmpty()
    ) {
      break;
    }
  }

  console.log(`   Processed ${processedCount} items`);

  // Test queue statistics
  console.log('\n4. Queue statistics:');

  console.log(
    `   High Priority Queue: ${highPriorityQueue.getSize()}/${highPriorityQueue.getCapacity()}`
  );
  console.log(
    `   Normal Queue: ${normalQueue.getSize()}/${normalQueue.getCapacity()}`
  );
  console.log(
    `   Low Priority Queue: ${lowPriorityQueue.getSize()}/${lowPriorityQueue.getCapacity()}`
  );

  // Test queue overflow handling
  console.log('\n5. Testing queue overflow handling:');

  const smallQueue = new LockFreeQueue(5);

  for (let i = 0; i < 10; i++) {
    const success = smallQueue.enqueue(i);
    console.log(`   Enqueue ${i}: ${success ? 'Success' : 'Failed'}`);
  }

  console.log(`   Final size: ${smallQueue.getSize()}`);

  // Cleanup
  console.log('\n6. Cleanup:');

  highPriorityQueue.destroy();
  normalQueue.destroy();
  lowPriorityQueue.destroy();
  smallQueue.destroy();

  console.log('   All queues destroyed');
  setImmediate(() => process.exit(0));
}

// Run the example
advancedPatterns().catch(console.error);
