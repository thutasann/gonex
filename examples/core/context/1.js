// @ts-check
import { go, Background, withCancel, sleep } from '../../../dist/index.js';

/**
 * Context Example 1: Basic Cancellation
 *
 * This example demonstrates how context cancellation works:
 * 1. Creates a cancellable context using withCancel()
 * 2. Starts a goroutine that does work and checks for cancellation
 * 3. Cancels the context after a delay
 * 4. Shows how the goroutine detects and responds to cancellation
 */
const [ctx, cancel] = withCancel(Background);

/**
 * Start a goroutine that will be cancelled
 * The goroutine will:
 * - Do work in small chunks
 * - Check for cancellation after each chunk
 * - Stop immediately when cancelled
 */
go(async () => {
  try {
    console.log('   Starting work with context...');

    // Do work in small chunks to allow cancellation detection
    for (let i = 0; i < 10; i++) {
      await sleep(50);
      console.log(`   Working... step ${i + 1}`);

      // Check if context was cancelled
      const err = ctx.err();
      console.log(
        `   Context error at step ${i + 1}:`,
        err ? err.message : 'null'
      );

      if (err) {
        console.log(`   Work cancelled: ${err.message}`);
        return;
      }
    }

    console.log('   Work completed successfully!');
  } catch (error) {
    console.log(`   Work failed: ${error.message}`);
  }
});

/**
 * Cancel the context after 200ms
 * This will:
 * - Set the context's error to ContextCancelledError
 * - Close the done channel
 * - Allow the goroutine to detect cancellation
 */
setTimeout(() => {
  console.log('   Cancelling context...');
  cancel();
  console.log('   Context cancelled, error:', ctx.err()?.message);
}, 200);

// Wait for the example to complete
await sleep(600);
console.log('✅ Basic cancellation example completed!');
