/* eslint-disable no-inner-declarations */
// @ts-check
import {
  go,
  channel,
  waitGroup,
  mutex,
  semaphore,
  once,
  sleep,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../dist/index.js';

// Initialize Parallel Scheduler
await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  loadBalancing: 'least-busy',
  sharedMemory: true,
  timeout: 60000, // Increased timeout to 60 seconds
});

console.log(
  '=== Combined Example: Web Server Simulator with True Parallelism ===\n'
);

// Simulate a web server with connection pooling, rate limiting, and shared state
class WebServerSimulator {
  constructor() {
    this.connectionPool = semaphore({ permits: 5 }); // Max 5 concurrent connections
    this.rateLimiter = mutex(); // Rate limiting mutex
    this.requestChannel = channel({ bufferSize: 10 }); // Request queue
    this.responseChannel = channel({ bufferSize: 10 }); // Response queue
    this.activeRequests = 0;
    this.totalRequests = 0;
    this.sharedState = { users: 0, requests: 0 };
    this.stateMutex = mutex();

    // Initialize server once
    this.initServer = once({ name: 'initServer' });
    this.initServer.do(async () => {
      console.log('   🔧 Initializing server...');
      await sleep(200);
      console.log('   ✅ Server initialized!');
    });
  }

  async handleRequest(requestId) {
    await this.connectionPool.acquire();
    this.activeRequests++;

    try {
      console.log(
        `   📥 Request ${requestId} started (${this.activeRequests} active)`
      );

      // Rate limiting
      await this.rateLimiter.lock();
      await sleep(50); // Simulate rate limiting
      this.rateLimiter.unlock();

      // Update shared state
      await this.stateMutex.lock();
      this.sharedState.requests++;
      this.sharedState.users = Math.max(
        this.sharedState.users,
        this.activeRequests
      );
      const state = { ...this.sharedState };
      this.stateMutex.unlock();

      // Process request data using worker threads for CPU-intensive work
      const processedData = await go(
        requestId => {
          // CPU-intensive task that will run in worker threads
          async function processRequestData() {
            let result = 0;
            for (let i = 0; i < 10000000; i++) {
              result += Math.sqrt(i) * Math.pow(i, 0.1);
            }
            return { requestId, result: result.toFixed(2) };
          }
          return processRequestData();
        },
        [requestId],
        {
          useWorkerThreads: true,
        }
      );

      console.log(
        `   📤 Request ${requestId} completed (State: ${JSON.stringify(state)}, Data: ${processedData.result})`
      );
    } finally {
      this.activeRequests--;
      this.connectionPool.release();
    }
  }

  async start() {
    // Initialize server
    await this.initServer.do(async () => {
      console.log('   🔧 Initializing server...');
      await sleep(200);
      console.log('   ✅ Server initialized!');
    });

    // Start request handlers
    const wg = waitGroup();

    // Simulate incoming requests
    for (let i = 1; i <= 10; i++) {
      wg.add(1);
      go(async () => {
        await this.handleRequest(i);
        wg.done();
      });

      // Add some delay between requests
      await sleep(50);
    }

    // Wait for all requests to complete
    await wg.wait();
    console.log('   🎉 All requests completed!');
  }
}

async function main() {
  try {
    // Example 1: Web Server Simulation with Worker Threads
    console.log('1. Web Server Simulation (with Worker Threads):');
    const server = new WebServerSimulator();
    await server.start();

    // Example 2: Producer-Consumer Pattern with Parallel Processing
    console.log('\n2. Producer-Consumer Pattern (with Parallel Processing):');
    const taskQueue = channel({ bufferSize: 5 });
    const resultQueue = channel({ bufferSize: 5 });
    const producerWg = waitGroup();
    const consumerWg = waitGroup();

    // Producers
    for (let i = 1; i <= 3; i++) {
      producerWg.add(1);
      go(async () => {
        for (let j = 1; j <= 2; j++) {
          const task = { id: `task-${i}-${j}`, data: `data-${i}-${j}` };
          await taskQueue.send(task);
          console.log(`   📤 Producer ${i} sent: ${task.id}`);
          await sleep(100);
        }
        producerWg.done();
      });
    }

    // Consumers with worker thread processing
    for (let i = 1; i <= 2; i++) {
      consumerWg.add(1);
      go(async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            const task = await taskQueue.receive();
            if (!task) {
              console.log(`   🔚 Consumer ${i} finished: channel closed`);
              break;
            }
            console.log(`   📥 Consumer ${i} processing: ${task.id}`);

            // Process task using worker thread for CPU-intensive work
            const result = await go(
              task => {
                async function processTaskIntensively() {
                  let result = 0;
                  for (let i = 0; i < 5000000; i++) {
                    result += Math.pow(i, 0.5) * Math.sin(i * 0.01);
                  }
                  return {
                    ...task,
                    processed: true,
                    computationResult: result.toFixed(2),
                  };
                }
                return processTaskIntensively();
              },
              [task],
              {
                useWorkerThreads: true,
              }
            );

            await resultQueue.send({ ...result, consumer: i });
            console.log(
              `   ✅ Consumer ${i} completed: ${task.id} (Result: ${result.computationResult})`
            );
          } catch (error) {
            console.log(`   🔚 Consumer ${i} finished: ${error.message}`);
            break;
          }
        }
        consumerWg.done();
      });
    }

    // Result collector
    const resultCollector = go(async () => {
      await producerWg.wait();
      taskQueue.close();
      console.log('   📋 All producers finished, closing task queue');

      await consumerWg.wait();
      resultQueue.close();
      console.log('   📋 All consumers finished, closing result queue');

      // Collect all results
      const results = [];
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const result = await resultQueue.receive();
          if (!result) {
            break;
          }
          results.push(result);
        }
      } catch (error) {
        console.log(`   📊 Collected ${results.length} results`);
      }
    });

    // Example 3: Resource Management with Parallel Data Processing
    console.log('\n3. Resource Management (with Parallel Processing):');
    const databasePool = semaphore({ permits: 3 });
    const cacheMutex = mutex();
    const cache = new Map();

    async function getCachedData(key) {
      // Try cache first
      await cacheMutex.lock();
      try {
        if (cache.has(key)) {
          console.log(`   💾 Cache hit for: ${key}`);
          return cache.get(key);
        }
      } finally {
        cacheMutex.unlock();
      }

      // Get from database
      await databasePool.acquire();
      try {
        // Check cache again after acquiring database lock to handle race conditions
        await cacheMutex.lock();
        try {
          if (cache.has(key)) {
            console.log(`   💾 Cache hit for: ${key} (after DB lock)`);
            return cache.get(key);
          }
        } finally {
          cacheMutex.unlock();
        }

        console.log(`   🗄️  Database query for: ${key}`);
        await sleep(200);

        // Process data using worker thread for CPU-intensive work
        const data = await go(
          userId => {
            // CPU-intensive data processing function
            async function processUserData() {
              // Simulate heavy data processing
              let processedData = 0;
              for (let i = 0; i < 3000000; i++) {
                processedData += Math.log(i + 1) * Math.cos(i * 0.1);
              }
              return {
                userId,
                profile: `processed-profile-${userId}`,
                analytics: processedData.toFixed(2),
                timestamp: Date.now(),
              };
            }
            return processUserData();
          },
          [key],
          {
            useWorkerThreads: true,
          }
        );

        // Update cache
        await cacheMutex.lock();
        try {
          cache.set(key, data);
          console.log(`   💾 Cached: ${key} (Analytics: ${data.analytics})`);
        } finally {
          cacheMutex.unlock();
        }

        return data;
      } finally {
        databasePool.release();
      }
    }

    // Simulate multiple requests for the same data
    const dataRequests = [];
    for (let i = 1; i <= 5; i++) {
      dataRequests.push(
        go(async () => {
          try {
            const data = await getCachedData(`user-${i}`);
            console.log(
              `   📄 Request ${i} got: ${data.profile} (Analytics: ${data.analytics})`
            );
          } catch (error) {
            console.log(`   ❌ Request ${i} failed: ${error.message}`);
          }
        })
      );
    }

    // Example 4: Parallel Batch Processing
    console.log('\n4. Parallel Batch Processing:');
    const batchWg = waitGroup();

    // CPU-intensive batch processing function
    async function processBatch(batchId, items) {
      let totalResult = 0;
      for (let i = 0; i < items.length; i++) {
        // Simulate processing each item
        for (let j = 0; j < 1000000; j++) {
          totalResult += Math.pow(j, 0.3) * Math.exp(-j * 0.0001);
        }
      }
      return {
        batchId,
        itemCount: items.length,
        result: totalResult.toFixed(2),
      };
    }

    // Process multiple batches in parallel using worker threads
    const batches = [
      { id: 1, items: ['A', 'B', 'C'] },
      { id: 2, items: ['D', 'E', 'F', 'G'] },
      { id: 3, items: ['H', 'I'] },
      { id: 4, items: ['J', 'K', 'L', 'M', 'N'] },
    ];

    const batchPromises = [];
    for (const batch of batches) {
      batchWg.add(1);
      batchPromises.push(
        go(async () => {
          try {
            console.log(
              `   🔄 Starting batch ${batch.id} with ${batch.items.length} items`
            );

            // Process batch using worker thread
            const result = await go(
              () => processBatch(batch.id, batch.items),
              [],
              {
                useWorkerThreads: true,
              }
            );

            console.log(`   ✅ Batch ${batch.id} completed: ${result.result}`);
          } catch (error) {
            console.log(`   ❌ Batch ${batch.id} failed: ${error.message}`);
          } finally {
            batchWg.done();
          }
        })
      );
    }

    // Wait for all examples to complete
    console.log('\nAll combined examples started. Waiting for completion...\n');

    // Wait for all goroutines to complete
    await Promise.all([resultCollector, ...dataRequests, ...batchPromises]);

    await batchWg.wait();
    console.log('   🎉 All batches processed in parallel!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function and then shutdown
await main();
console.log('\nShutting down parallel scheduler...');
await shutdownParallelScheduler();
console.log('✅ Shutdown complete!');
