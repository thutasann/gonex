// @ts-check
import { go, sleep } from '../../../dist/index.js';

// Example 3: Goroutine with return value
console.log('\n3. Goroutine with return value:');
const result = go(async () => {
  await sleep(200);
  return 'Hello from goroutine with return!';
});

result.then(value => {
  console.log(`   Result: ${value}`);
});
