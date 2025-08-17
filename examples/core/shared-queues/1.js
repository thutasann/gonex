// @ts-check
import { LockFreeQueue } from '../../../dist/index.js';

console.log('=== Shared Queues Example 1: Lock-Free Queue ===\n');

// Example 1: Basic lock-free queue operations
async function lockFreeQueueExample() {
  console.log('1. Creating LockFreeQueue:');

  const queue = new LockFreeQueue(100);
  console.log('   Queue created with capacity 100');

  // Test basic operations
  console.log('\n2. Testing basic operations:');

  const enqueueResult = queue.enqueue(42);
  console.log(`   Enqueue 42: ${enqueueResult ? 'Success' : 'Failed'}`);

  const size = queue.getSize();
  console.log(`   Queue size: ${size}`);

  const isEmpty = queue.isEmpty();
  console.log(`   Is empty: ${isEmpty}`);

  const capacity = queue.getCapacity();
  console.log(`   Capacity: ${capacity}`);

  // Test dequeue
  console.log('\n3. Testing dequeue:');
  const dequeued = queue.dequeue();
  console.log(`   Dequeued: ${dequeued}`);

  const newSize = queue.getSize();
  console.log(`   New size: ${newSize}`);

  // Test multiple operations
  console.log('\n4. Testing multiple operations:');

  for (let i = 1; i <= 5; i++) {
    const success = queue.enqueue(i * 10);
    console.log(`   Enqueue ${i * 10}: ${success ? 'Success' : 'Failed'}`);
  }

  console.log(`   Final size: ${queue.getSize()}`);

  // Dequeue all items
  console.log('\n5. Dequeuing all items:');
  while (!queue.isEmpty()) {
    const item = queue.dequeue();
    console.log(`   Dequeued: ${item}`);
  }

  console.log(`   Final size: ${queue.getSize()}`);
  console.log(`   Is empty: ${queue.isEmpty()}`);

  // Test performance
  console.log('\n6. Performance test:');
  const startTime = performance.now();

  for (let i = 0; i < 1000; i++) {
    queue.enqueue(i);
  }

  const enqueueTime = performance.now() - startTime;
  console.log(`   Enqueued 1000 items in ${enqueueTime.toFixed(2)}ms`);

  const dequeueStart = performance.now();
  let count = 0;
  while (!queue.isEmpty() && count < 1000) {
    queue.dequeue();
    count++;
  }

  const dequeueTime = performance.now() - dequeueStart;
  console.log(`   Dequeued ${count} items in ${dequeueTime.toFixed(2)}ms`);

  // Cleanup
  console.log('\n7. Cleanup:');
  queue.destroy();
  console.log('   Queue destroyed');
}

// Run the example
lockFreeQueueExample().catch(console.error);
