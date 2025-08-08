// @ts-check
import { goAll, ticker } from '../../../dist/index.js';

/**
 * Example 2: Multiple Tickers with Different Intervals
 *
 * Demonstrates:
 * - Creating multiple tickers with different intervals
 * - Running multiple tickers concurrently
 * - Using goAll to manage multiple goroutines
 * - Different ticker behaviors
 */
async function multipleTickersExample() {
  console.log('🕐 Example 2: Multiple Tickers with Different Intervals');
  console.log('Creating 3 tickers with different intervals...\n');

  // Create tickers with different intervals
  const fastTicker = ticker({ interval: 200, name: 'FastTicker' });
  const mediumTicker = ticker({ interval: 500, name: 'MediumTicker' });
  const slowTicker = ticker({ interval: 1000, name: 'SlowTicker' });

  // Start all tickers
  const fastChannel = fastTicker.start();
  const mediumChannel = mediumTicker.start();
  const slowChannel = slowTicker.start();

  console.log('All tickers started! Running for 4 seconds...\n');

  // Create tasks for each ticker
  const tasks = [
    // Fast ticker task
    async () => {
      let count = 0;
      const startTime = Date.now();

      while (Date.now() - startTime < 4000) {
        const tick = await fastChannel.receive();
        if (tick !== undefined) {
          count++;
          console.log(
            `⚡ Fast tick ${tick}: ${new Date().toLocaleTimeString()}`
          );
        }
      }

      console.log(`\n⚡ Fast ticker completed: ${count} ticks`);
    },

    // Medium ticker task
    async () => {
      let count = 0;
      const startTime = Date.now();

      while (Date.now() - startTime < 4000) {
        const tick = await mediumChannel.receive();
        if (tick !== undefined) {
          count++;
          console.log(
            `🔄 Medium tick ${tick}: ${new Date().toLocaleTimeString()}`
          );
        }
      }

      console.log(`\n🔄 Medium ticker completed: ${count} ticks`);
    },

    // Slow ticker task
    async () => {
      let count = 0;
      const startTime = Date.now();

      while (Date.now() - startTime < 4000) {
        const tick = await slowChannel.receive();
        if (tick !== undefined) {
          count++;
          console.log(
            `🐌 Slow tick ${tick}: ${new Date().toLocaleTimeString()}`
          );
        }
      }

      console.log(`\n🐌 Slow ticker completed: ${count} ticks`);
    },
  ];

  // Run all tasks concurrently
  await goAll(tasks);

  // Stop all tickers
  fastTicker.stop();
  mediumTicker.stop();
  slowTicker.stop();

  console.log('\n🛑 All tickers stopped');
  console.log(`📊 Final counts:`);
  console.log(`  Fast ticker: ${fastTicker.getTickCount()} ticks`);
  console.log(`  Medium ticker: ${mediumTicker.getTickCount()} ticks`);
  console.log(`  Slow ticker: ${slowTicker.getTickCount()} ticks`);
}

// Run the example
multipleTickersExample().catch(console.error);
