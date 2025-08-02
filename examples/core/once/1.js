// @ts-check
import { go, once, sleep } from '../../../dist/index.js';

console.log('=== Once Example ===\n');

// Example 1: Basic once usage
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
