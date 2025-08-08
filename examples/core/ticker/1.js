// @ts-check
import { go, ticker } from '../../../dist/index.js';

/**
 * Example 1: Basic Ticker Usage
 *
 * Demonstrates:
 * - Creating a ticker with a specific interval
 * - Starting the ticker and getting a channel
 * - Receiving tick events from the channel
 * - Stopping the ticker after a certain time
 */
async function basicTickerExample() {
  console.log('🕐 Example 1: Basic Ticker Usage');
  console.log('Creating a ticker that sends events every 500ms...\n');

  // Create a ticker with 500ms interval
  const tickerInstance = ticker({ interval: 500, name: 'BasicTicker' });

  // Start the ticker and get the channel
  const channel = tickerInstance.start();

  console.log('Ticker started! Receiving ticks for 3 seconds...\n');

  // Goroutine to receive tick events
  go(async () => {
    let tickCount = 0;

    try {
      // Receive ticks for 3 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < 3000) {
        const tick = await channel.receive();
        if (tick !== undefined) {
          tickCount++;
          console.log(
            `📊 Tick ${tick}: Received at ${new Date().toLocaleTimeString()}`
          );
        }
      }

      console.log(`\n✅ Received ${tickCount} ticks in 3 seconds`);
    } catch (error) {
      console.error('❌ Error receiving ticks:', error.message);
    }
  });

  // Wait for 3 seconds then stop the ticker
  await new Promise(resolve => setTimeout(resolve, 3000));

  tickerInstance.stop();
  console.log('\n🛑 Ticker stopped');

  console.log(`📈 Final tick count: ${tickerInstance.getTickCount()}`);
}

// Run the example
basicTickerExample().catch(console.error);
