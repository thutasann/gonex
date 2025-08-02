// @ts-check
import { go, once, sleep } from '../../../dist/index.js';

// Example 2: Once with error handling
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
