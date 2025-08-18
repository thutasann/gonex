// @ts-check
import { MultiProducerQueue } from '../../../dist/index.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

console.log(`import.meta.url --> `, import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Shared Queues Example 2: Multi-Producer Queue ===\n');

// Example 2: Multi-producer queue with worker threads
async function multiProducerQueueExample() {
  console.log('1. Creating MultiProducerQueue:');

  const queue = new MultiProducerQueue(50);
  console.log('   Queue created with capacity 50');

  // Create producer workers
  console.log('\n2. Creating producer workers:');

  const producerCount = 3;
  const producers = [];

  for (let i = 0; i < producerCount; i++) {
    const producer = new Worker(join(__dirname, 'producer-worker.js'), {
      workerData: {
        workerId: i,
        itemCount: 20,
      },
    });

    // Set up producer message handling
    producer.on('message', async msg => {
      if (msg.type === 'enqueue') {
        try {
          const success = await queue.enqueue(msg.item);
          if (success) {
            producer.postMessage({
              type: 'enqueue_success',
              itemId: msg.item.id,
            });
          } else {
            producer.postMessage({
              type: 'enqueue_failed',
              itemId: msg.item.id,
            });
          }
        } catch (error) {
          producer.postMessage({
            type: 'enqueue_error',
            itemId: msg.item.id,
            error: error.message,
          });
        }
      }
    });

    producers.push(producer);
    console.log(`   Producer ${i} created`);
  }

  // Create consumer worker
  console.log('\n3. Creating consumer worker:');

  const consumer = new Worker(join(__dirname, 'consumer-worker.js'), {
    workerData: {
      expectedItems: producerCount * 20,
    },
  });

  // Set up consumer message handling
  consumer.on('message', async msg => {
    if (msg.type === 'dequeue_request') {
      try {
        const item = await queue.dequeue();
        if (item !== undefined) {
          consumer.postMessage({ type: 'dequeue_success', item });
        } else {
          consumer.postMessage({ type: 'dequeue_empty' });
        }
      } catch (error) {
        consumer.postMessage({ type: 'dequeue_error', error: error.message });
      }
    }
  });

  console.log('   Consumer created');

  // Wait for all workers to complete
  console.log('\n4. Waiting for workers to complete:');

  const producerPromises = producers.map(producer => {
    return new Promise((resolve, reject) => {
      producer.on('message', msg => {
        if (msg.type === 'complete') {
          console.log(`   Producer ${msg.workerId} completed`);
          resolve(msg);
        }
      });
      producer.on('error', reject);
    });
  });

  const consumerPromise = new Promise((resolve, reject) => {
    consumer.on('message', msg => {
      if (msg.type === 'complete') {
        console.log(
          `   Consumer completed, processed ${msg.processedCount} items`
        );
        resolve(msg);
      }
    });
    consumer.on('error', reject);
  });

  // Wait for all to complete
  await Promise.all([...producerPromises, consumerPromise]);

  console.log('\n5. All workers completed successfully');

  // Cleanup
  console.log('\n6. Cleanup:');

  producers.forEach(producer => producer.terminate());
  consumer.terminate();
  queue.destroy();

  console.log('   All workers terminated and queue destroyed');
}

// Run the example
multiProducerQueueExample().catch(console.error);
