// @ts-check
import {
  go,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../dist/index.js';

console.log('=== Fixed Worker Thread Test ===\n');

// Initialize parallel scheduler
console.log('1. Initializing parallel scheduler...');
await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 2,
});

console.log('\n2. Testing isolated worker thread execution...');

// Self-contained function with no external references
const isolatedComputation = () => {
  console.log('Worker: Starting isolated computation...');
  let result = 0;
  for (let i = 0; i < 100000; i++) {
    result += i;
  }
  console.log('Worker: Isolated computation completed');
  return { result, message: 'Isolated computation successful' };
};

try {
  const result = await go(isolatedComputation, {
    useWorkerThreads: true,
    name: 'isolated-test',
  });

  console.log('✅ Success! Result:', result);
} catch (error) {
  console.error('❌ Error:', error.message);
}

console.log('\n3. Testing arrow function...');

// Arrow function test
const arrowComputation = () => {
  console.log('Worker: Starting arrow computation...');
  let sum = 0;
  for (let i = 0; i < 50000; i++) {
    sum += Math.sqrt(i);
  }
  console.log('Worker: Arrow computation completed');
  return { sum: sum.toFixed(2), type: 'arrow' };
};

try {
  const result = await go(arrowComputation, {
    useWorkerThreads: true,
    name: 'arrow-test',
  });

  console.log('✅ Success! Result:', result);
} catch (error) {
  console.error('❌ Error:', error.message);
}

console.log('\n4. Shutting down...');
await shutdownParallelScheduler();

console.log('\n=== Test Complete ===');
