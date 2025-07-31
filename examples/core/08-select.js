// @ts-check
import { channel, go, sleep, select } from '../../dist/index.js';

console.log('=== Select Example ===\n');

// Example 1: Basic select with multiple channels
console.log('1. Basic select with multiple channels:');
const ch1 = channel();
const ch2 = channel();

go(async () => {
  await sleep(100);
  await ch1.send('hello from channel 1');
});

go(async () => {
  await sleep(200);
  await ch2.send('Hello from channel 2');
});

go(async () => {
  const result = await select([
    { channel: ch1, operation: 'receive' },
    { channel: ch2, operation: 'receive' },
  ]);
  console.log(`   Selected result: ${result}`);
});
