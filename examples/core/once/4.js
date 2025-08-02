// @ts-check
import { go, once, sleep } from '../../../dist/index.js';

// Example 4: Once with timeout
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
