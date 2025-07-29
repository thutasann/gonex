// @ts-check
// NOTE: This example is still not stable, and some of the code is not working as expected.
import { go, channel, waitGroup, mutex, semaphore, once, sleep } from 'gonex';

console.log('=== Combined Example: Web Server Simulator ===\n');

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

      // Simulate request processing
      await sleep(100 + Math.random() * 200);

      console.log(
        `   📤 Request ${requestId} completed (State: ${JSON.stringify(state)})`
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

// Example 1: Web Server Simulation
console.log('1. Web Server Simulation:');
const server = new WebServerSimulator();
server.start();

// Example 2: Producer-Consumer Pattern
console.log('\n2. Producer-Consumer Pattern:');
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

// Consumers
for (let i = 1; i <= 2; i++) {
  consumerWg.add(1);
  go(async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const task = await taskQueue.receive();
        console.log(`   📥 Consumer ${i} processing: ${task.id}`);
        await sleep(150);
        const result = { ...task, processed: true, consumer: i };
        await resultQueue.send(result);
        console.log(`   ✅ Consumer ${i} completed: ${task.id}`);
      } catch (error) {
        console.log(`   🔚 Consumer ${i} finished: ${error.message}`);
        break;
      }
    }
    consumerWg.done();
  });
}

// Result collector
go(async () => {
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
      results.push(result);
    }
  } catch (error) {
    console.log(`   📊 Collected ${results.length} results`);
  }
});

// Example 3: Resource Management with Semaphore and Mutex
console.log('\n3. Resource Management:');
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
    console.log(`   🗄️  Database query for: ${key}`);
    await sleep(200);
    const data = `data-for-${key}`;

    // Update cache
    await cacheMutex.lock();
    try {
      cache.set(key, data);
      console.log(`   💾 Cached: ${key}`);
    } finally {
      cacheMutex.unlock();
    }

    return data;
  } finally {
    databasePool.release();
  }
}

// Simulate multiple requests for the same data
for (let i = 1; i <= 5; i++) {
  go(async () => {
    const data = await getCachedData('user-profile');
    console.log(`   📄 Request ${i} got: ${data}`);
  });
}

console.log('\nAll combined examples started. Waiting for completion...\n');
