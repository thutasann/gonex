// @ts-check
import { go, Background, withTimeout, sleep } from '../../../dist/index.js';

/**
 * Context Example 3: Timeout Cancellation
 *
 * This example demonstrates how context timeout works:
 * 1. Creates a context with timeout using withTimeout()
 * 2. Starts a goroutine that does work and checks for timeout
 * 3. The context automatically cancels after the timeout period
 * 4. Shows how the goroutine detects and responds to timeout
 */
const [ctx] = withTimeout(Background, 300); // 300ms timeout

/**
 * Start a goroutine that will be cancelled by timeout
 * The goroutine will:
 * - Do work in small chunks
 * - Check for timeout after each chunk
 * - Stop when the timeout occurs
 */
go(async () => {
  try {
    console.log('   Starting work with timeout context...');

    // Do work in small chunks to allow timeout detection
    for (let i = 0; i < 10; i++) {
      await sleep(50);
      console.log(`   Working... step ${i + 1}`);

      // Check if context was cancelled (timeout)
      const err = ctx.err();
      console.log(
        `   Context error at step ${i + 1}:`,
        err ? err.message : 'null'
      );

      if (err) {
        console.log(`   Work timed out: ${err.message}`);
        return;
      }
    }

    console.log('   Work completed successfully!');
  } catch (error) {
    console.log(`   Work failed: ${error.message}`);
  }
});

/**
 * Note: We don't need to manually cancel - the timeout will do it
 * The context will automatically cancel after 300ms
 */
console.log('   Context will timeout after 300ms');

// Wait for the example to complete
await sleep(600);
console.log('✅ Timeout example completed!');
