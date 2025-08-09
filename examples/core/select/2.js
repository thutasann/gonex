// @ts-check
import {
  channel,
  go,
  sleep,
  select,
  INFINITE_TIMEOUT,
} from '../../../dist/index.js';

console.log('=== Select Example 2: Timeout Scenarios ===\n');

// Example 2: Select with timeout
const slowChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
const fastChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout

// Slow sender
go(async () => {
  await sleep(2000); // 2 seconds delay
  await slowChannel.send('slow message');
  console.log('   Slow sender: sent message');
});

// Fast sender
go(async () => {
  await sleep(100); // 100ms delay
  await fastChannel.send('fast message');
  console.log('   Fast sender: sent message');
});

// Test 1: Select with timeout that succeeds
go(async () => {
  try {
    const result = await select(
      [
        { channel: slowChannel, operation: 'receive' },
        { channel: fastChannel, operation: 'receive' },
      ],
      { timeout: 500 }
    ); // 500ms timeout

    console.log(`   Test 1 - Selected result: ${result}`);
  } catch (error) {
    console.log(`   Test 1 - Timeout error: ${error.message}`);
  }
});

// Test 2: Select with timeout that fails
go(async () => {
  await sleep(200); // Wait for fast channel to be consumed

  try {
    const result = await select(
      [{ channel: slowChannel, operation: 'receive' }],
      { timeout: 300 }
    ); // 300ms timeout, but slow channel takes 2s

    console.log(`   Test 2 - Selected result: ${result}`);
  } catch (error) {
    console.log(`   Test 2 - Expected timeout: ${error.message}`);
  }
});

// Test 3: Select with infinite timeout
go(async () => {
  await sleep(300); // Wait for timeout test to complete

  const result = await select(
    [{ channel: slowChannel, operation: 'receive' }],
    { timeout: -1 }
  ); // Infinite timeout

  console.log(`   Test 3 - Eventually received: ${result}`);
});
