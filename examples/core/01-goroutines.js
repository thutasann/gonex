// @ts-check
import { go, sleep } from '../../dist/index.js';

console.log('=== Goroutines Example ===\n');

// Example 1: Simple goroutine
console.log('1. Simple goroutine:');
go(async () => {
  console.log('   Hello from goroutine!');
});

// Example 2: Multiple concurrent goroutines
console.log('\n2. Multiple concurrent goroutines:');
for (let i = 1; i <= 3; i++) {
  go(async () => {
    await sleep(100 * i);
    console.log(`   Goroutine ${i} completed after ${100 * i}ms`);
  });
}

// Example 3: Goroutine with return value
console.log('\n3. Goroutine with return value:');
const result = go(async () => {
  await sleep(200);
  return 'Hello from goroutine with return!';
});

result.then(value => {
  console.log(`   Result: ${value}`);
});

// Example 4: Error handling in goroutines
console.log('\n4. Error handling in goroutines:');
go(async () => {
  try {
    throw new Error('This is a test error');
  } catch (error) {
    console.log(`   Caught error: ${error.message}`);
  }
});

// Example 5: Goroutine with async operations
console.log('\n5. Goroutine with async operations:');
go(async () => {
  console.log('   Starting async operation...');
  await sleep(300);
  console.log('   Async operation completed!');
});

console.log('\nAll goroutines started. Waiting for completion...\n');
