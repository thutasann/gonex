// @ts-check
import { go, once, sleep } from 'gonex';

console.log('=== Once Example ===\n');

// Example 1: Basic once usage
console.log('1. Basic once usage:');
const initOnce = once(async () => {
  console.log('   Initializing resource...');
  await sleep(200);
  console.log('   Resource initialized!');
  return 'initialized';
});

// Multiple calls to the same function
for (let i = 1; i <= 3; i++) {
  go(async () => {
    const result = await initOnce();
    console.log(`   Call ${i} got result: ${result}`);
  });
}

// Example 2: Once with error handling
console.log('\n2. Once with error handling:');
const errorOnce = once(async () => {
  console.log('   Attempting risky operation...');
  await sleep(100);
  throw new Error('Operation failed');
});

for (let i = 1; i <= 2; i++) {
  go(async () => {
    try {
      await errorOnce();
    } catch (error) {
      console.log(`   Call ${i} caught error: ${error.message}`);
    }
  });
}

// Example 3: Once with different return values
console.log('\n3. Once with different return values:');
let callCount = 0;
const counterOnce = once(async () => {
  callCount++;
  console.log(`   Function called ${callCount} time(s)`);
  await sleep(50);
  return `result-${callCount}`;
});

for (let i = 1; i <= 4; i++) {
  go(async () => {
    const result = await counterOnce();
    console.log(`   Call ${i} got: ${result}`);
  });
}

// Example 4: Once with timeout
console.log('\n4. Once with timeout:');
const timeoutOnce = once(async () => {
  console.log('   Starting long operation...');
  await sleep(1000);
  console.log('   Long operation completed');
  return 'completed';
});

go(async () => {
  try {
    const result = await timeoutOnce();
    console.log(`   Got result: ${result}`);
  } catch (error) {
    console.log(`   Timeout error: ${error.message}`);
  }
});

go(async () => {
  try {
    // This should get the same result as the first call
    const result = await timeoutOnce();
    console.log(`   Second call got: ${result}`);
  } catch (error) {
    console.log(`   Second call error: ${error.message}`);
  }
});

// Example 5: Once with cleanup
console.log('\n5. Once with cleanup:');
let resource = null;
const cleanupOnce = once(async () => {
  console.log('   Creating resource...');
  await sleep(100);
  resource = { id: 'resource-1', status: 'active' };
  console.log('   Resource created');

  // Return cleanup function
  return () => {
    console.log('   Cleaning up resource...');
    resource = null;
    console.log('   Resource cleaned up');
  };
});

go(async () => {
  const cleanup = await cleanupOnce();
  console.log('   First call completed');

  // Simulate cleanup after some time
  await sleep(300);
  cleanup();
});

go(async () => {
  const cleanup = await cleanupOnce();
  console.log('   Second call completed (should reuse same resource)');
});

console.log('\nAll once examples started. Waiting for completion...\n');
