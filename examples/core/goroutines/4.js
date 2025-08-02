// @ts-check
import { go } from '../../../dist/index.js';

// Example 4: Error handling in goroutines
console.log('\n4. Error handling in goroutines:');
go(async () => {
  try {
    throw new Error('This is a test error');
  } catch (error) {
    console.log(`   Caught error: ${error.message}`);
  }
});
