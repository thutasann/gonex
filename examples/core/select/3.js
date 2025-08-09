// @ts-check
import {
  channel,
  go,
  sleep,
  select,
  INFINITE_TIMEOUT,
} from '../../../dist/index.js';

console.log('=== Select Example 3: Default Case ===\n');

// Example 3: Select with default case
const dataChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
const controlChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout

// Delayed data sender
go(async () => {
  await sleep(1000); // 1 second delay
  await dataChannel.send('important data');
  console.log('   Data sender: sent important data');
});

// Test 1: Immediate default case
go(async () => {
  console.log('   Test 1: Checking for immediate data...');

  const result = await select(
    [
      { channel: dataChannel, operation: 'receive' },
      { channel: controlChannel, operation: 'receive' },
    ],
    {
      default: () => {
        console.log('   Test 1: No data available immediately, using default');
      },
    }
  );

  if (result === undefined) {
    console.log(
      '   Test 1: Default case executed, continuing with fallback logic'
    );
  } else {
    console.log(`   Test 1: Received data: ${result}`);
  }
});

// Test 2: Polling with default case
go(async () => {
  await sleep(200); // Wait a bit before starting polling

  console.log('   Test 2: Starting polling with default fallback...');

  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;

    const result = await select(
      [{ channel: dataChannel, operation: 'receive' }],
      {
        default: () => {
          console.log(
            `   Test 2: Attempt ${attempts} - no data yet, continuing poll`
          );
        },
      }
    );

    if (result !== undefined) {
      console.log(`   Test 2: Got data on attempt ${attempts}: ${result}`);
      break;
    }

    // Wait before next poll
    await sleep(300);
  }

  if (attempts >= maxAttempts) {
    console.log('   Test 2: Max polling attempts reached');
  }
});

// Test 3: Non-blocking channel check
go(async () => {
  await sleep(500); // Wait before testing

  console.log('   Test 3: Non-blocking check for control signals...');

  // Simulate checking for control signals without blocking
  const controlResult = await select(
    [{ channel: controlChannel, operation: 'receive' }],
    {
      default: () => {
        console.log(
          '   Test 3: No control signals, proceeding with normal operation'
        );
      },
    }
  );

  if (controlResult !== undefined) {
    console.log(`   Test 3: Control signal received: ${controlResult}`);
  } else {
    console.log('   Test 3: Continuing normal operation...');
  }
});

// Test 4: Resource availability check
go(async () => {
  await sleep(1500); // Wait for data to be available

  console.log('   Test 4: Checking resource availability...');

  const resourceResult = await select(
    [{ channel: dataChannel, operation: 'receive' }],
    {
      default: () => {
        console.log('   Test 4: Resource not ready, using cached data');
      },
    }
  );

  if (resourceResult !== undefined) {
    console.log(`   Test 4: Fresh resource available: ${resourceResult}`);
  } else {
    console.log('   Test 4: Using cached/default resource');
  }
});
