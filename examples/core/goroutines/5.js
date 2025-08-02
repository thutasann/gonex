// @ts-check
import { go, sleep } from '../../../dist/index.js';

// Example 5: Goroutine with async operations
go(async () => {
  console.log('   Starting async operation...');
  await sleep(300);
  console.log('   Async operation completed!');
});
