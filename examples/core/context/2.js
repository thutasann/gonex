// @ts-check
import { go, Background, withCancel, sleep } from '../../../dist/index.js';

/**
 * Context Example 2: No Cancellation
 *
 * This example demonstrates context cancellation when NO cancellation occurs:
 * 1. Creates a cancellable context using withCancel()
 * 2. Starts a goroutine that does work and checks for cancellation
 * 3. Does NOT cancel the context
 * 4. Shows how the goroutine completes successfully
 */
const [ctx] = withCancel(Background);

/**
 * Start a goroutine that will NOT be cancelled
 * The goroutine will:
 * - Do work in small chunks
 * - Check for cancellation after each chunk
 * - Complete all work successfully since no cancellation occurs
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
 * Note: We do NOT cancel the context in this example
 * This allows the goroutine to complete all its work
 */
console.log('   Context will NOT be cancelled - work should complete');

// Wait for the example to complete
await sleep(600);
console.log('✅ No cancellation example completed!');
