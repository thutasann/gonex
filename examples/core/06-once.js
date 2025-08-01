// @ts-check
import { go, once, sleep } from '../../dist/index.js';

console.log('=== Once Example ===\n');

// Example 1: Basic once usage
console.log('1. Basic once usage:');
const initOnce = once({ name: 'initOnce' });
initOnce.do(async () => {
  console.log('   Initializing resource...');
  await sleep(200);
  console.log('   Resource initialized!');
});

// Multiple calls to the same function
for (let i = 1; i <= 3; i++) {
  go(async () => {
    await initOnce.do(async () => {
      console.log('   Initializing resource...');
      await sleep(200);
      console.log('   Resource initialized!');
    });
  });
}

// Example 2: Once with error handling
console.log('\n2. Once with error handling:');
const errorOnce = once({ name: 'errorOnce' });

try {
  await errorOnce.do(async () => {
    console.log('   Attempting risky operation...');
    await sleep(100);
    throw new Error('Operation failed');
  });
} catch (error) {
  console.log(`   Initial call caught error: ${error.message}`);
}

for (let i = 1; i <= 2; i++) {
  go(async () => {
    try {
      await errorOnce.do(async () => {
        console.log('   Attempting risky operation...');
        await sleep(100);
        throw new Error('Operation failed');
      });
    } catch (error) {
      console.log(`   Call ${i} caught error: ${error.message}`);
    }
  });
}

// Example 3: Once with different return values
console.log('\n3. Once with different return values:');
let callCount = 0;
const counterOnce = once({ name: 'counterOnce' });
counterOnce.do(async () => {
  callCount++;
  console.log(`   Function called ${callCount} time(s)`);
  await sleep(50);
});

for (let i = 1; i <= 4; i++) {
  go(async () => {
    await counterOnce.do(async () => {
      callCount++;
      console.log(`   Function called ${callCount} time(s)`);
      await sleep(50);
    });
  });
}

// Example 4: Once with timeout
console.log('\n4. Once with timeout:');
const timeoutOnce = once({ name: 'timeoutOnce' });
timeoutOnce.do(async () => {
  console.log('   Starting long operation...');
  await sleep(1000);
  console.log('   Long operation completed');
});

go(async () => {
  try {
    await timeoutOnce.do(async () => {
      console.log('   Starting long operation...');
      await sleep(1000);
      console.log('   Long operation completed');
    });
  } catch (error) {
    console.log(`   Timeout error: ${error.message}`);
  }
});

go(async () => {
  try {
    // This should get the same result as the first call
    await timeoutOnce.do(async () => {
      console.log('   Starting long operation...');
      await sleep(1000);
      console.log('   Long operation completed');
    });
  } catch (error) {
    console.log(`   Second call error: ${error.message}`);
  }
});

// Example 5: Once with cleanup
console.log('\n5. Once with cleanup:');
let resource = null;
const cleanupOnce = once({ name: 'cleanupOnce' });
cleanupOnce.do(async () => {
  console.log('   Creating resource...');
  await sleep(100);
  resource = { id: 'resource-1', status: 'active' };
  console.log('   Resource created', resource);
});

go(async () => {
  await cleanupOnce.do(async () => {
    console.log('   Creating resource...');
    await sleep(100);
    resource = { id: 'resource-1', status: 'active' };
    console.log('   Resource created', resource);
  });
  console.log('   First call completed');

  // Simulate cleanup after some time
  await sleep(300);
  console.log('   Cleaning up resource...');
  resource = null;
  console.log('   Resource cleaned up');
});

go(async () => {
  await cleanupOnce.do(async () => {
    console.log('   Creating resource...');
    await sleep(100);
    resource = { id: 'resource-1', status: 'active' };
    console.log('   Resource created', resource);
  });
  console.log('   Second call completed (should reuse same resource)');
});

console.log('\nAll once examples started. Waiting for completion...\n');
