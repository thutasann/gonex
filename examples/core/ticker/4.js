// @ts-check
import { go, ticker, channel } from '../../../dist/index.js';

/**
 * Example 4: Ticker with Error Handling and Timeouts
 *
 * Demonstrates:
 * - Handling ticker errors gracefully
 * - Using channels with timeouts
 * - Error recovery mechanisms
 * - Robust ticker lifecycle management
 */
async function tickerErrorHandlingExample() {
  console.log('🕐 Example 4: Ticker with Error Handling and Timeouts');
  console.log('Creating tickers with error handling scenarios...\n');

  // Create a ticker with very fast interval to test error handling
  const fastTicker = ticker({ interval: 50, name: 'FastTicker' });
  const controlChannel = channel({ timeout: 1000, name: 'ControlChannel' });

  console.log('✅ Fast ticker started (50ms interval)');
  console.log('⚠️  Control channel created with 1000ms timeout\n');

  // Goroutine to handle ticker events with error handling
  go(async () => {
    let tickCount = 0;
    let errorCount = 0;

    try {
      const startTime = Date.now();

      while (Date.now() - startTime < 5000) {
        try {
          // Try to receive with timeout
          const tick = await fastTicker.start().receive();

          if (tick !== undefined) {
            tickCount++;
            console.log(`📊 Tick ${tick}: ${new Date().toLocaleTimeString()}`);

            // Simulate occasional processing errors
            if (tick % 10 === 0) {
              console.log(`⚠️  Simulating processing error on tick ${tick}`);
              throw new Error(`Processing error on tick ${tick}`);
            }
          }
        } catch (error) {
          errorCount++;
          console.log(`❌ Error on tick ${tickCount}: ${error.message}`);

          // Continue processing despite errors
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`\n✅ Processing completed:`);
      console.log(`  Successful ticks: ${tickCount}`);
      console.log(`  Errors handled: ${errorCount}`);
    } catch (error) {
      console.error('❌ Fatal error in ticker processor:', error.message);
    }
  });

  // Goroutine to test timeout scenarios
  go(async () => {
    console.log('🕐 Testing timeout scenarios...\n');

    try {
      // Try to receive from control channel (should timeout)
      await controlChannel.receive();
    } catch (error) {
      console.log(`⏰ Expected timeout: ${error.message}`);
    }

    // Send a message to control channel
    try {
      await controlChannel.send('Control message');
      console.log('✅ Control message sent successfully');
    } catch (error) {
      console.log(`❌ Error sending control message: ${error.message}`);
    }
  });

  // Goroutine to monitor ticker state and handle cleanup
  go(async () => {
    let lastTickCount = 0;
    const maxTicks = 100;

    while (fastTicker.getIsRunning() && lastTickCount < maxTicks) {
      const currentTickCount = fastTicker.getTickCount();

      if (currentTickCount !== lastTickCount) {
        lastTickCount = currentTickCount;

        // Stop ticker if it reaches max ticks
        if (currentTickCount >= maxTicks) {
          console.log(
            `\n🛑 Reached max ticks (${maxTicks}), stopping ticker...`
          );
          fastTicker.stop();
          break;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }
  });

  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, 6000));

  // Cleanup
  fastTicker.stop();
  controlChannel.close();

  console.log('\n🛑 All tickers and channels stopped');
  console.log(`📊 Final statistics:`);
  console.log(`  Fast ticker ticks: ${fastTicker.getTickCount()}`);
  console.log(`  Fast ticker running: ${fastTicker.getIsRunning()}`);
  console.log(`  Control channel closed: ${controlChannel.isClosed()}`);
}

// Run the example
tickerErrorHandlingExample().catch(console.error);
