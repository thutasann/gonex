/* eslint-disable no-constant-condition */
// @ts-check
import { go, ticker } from '../../../dist/index.js';

/**
 * Example 3: Dynamic Ticker Control
 *
 * Demonstrates:
 * - Changing ticker interval dynamically
 * - Pausing and resuming ticker behavior
 * - Monitoring ticker state
 * - Complex ticker lifecycle management
 */
async function dynamicTickerExample() {
  console.log('🕐 Example 3: Dynamic Ticker Control');
  console.log('Creating a ticker with dynamic interval changes...\n');

  // Create a ticker starting with 1 second interval
  const tickerInstance = ticker({ interval: 1000, name: 'DynamicTicker' });
  const channel = tickerInstance.start();

  console.log('✅ Ticker started with 1000ms interval');

  // Goroutine to receive and process ticks
  go(async () => {
    let totalTicks = 0;
    let phase = 1;

    try {
      while (true) {
        const tick = await channel.receive();
        if (tick === undefined) {
          console.log('🛑 Channel closed, stopping receiver');
          break;
        }

        totalTicks++;
        console.log(
          `📊 Tick ${tick} (Phase ${phase}): ${new Date().toLocaleTimeString()}`
        );

        // Phase transitions based on tick count
        if (tick === 3 && phase === 1) {
          console.log('\n🔄 Changing to fast mode (200ms interval)...');
          tickerInstance.setInterval(200);
          phase = 2;
        } else if (tick === 8 && phase === 2) {
          console.log('\n🔄 Changing to slow mode (2000ms interval)...');
          tickerInstance.setInterval(2000);
          phase = 3;
        } else if (tick === 10 && phase === 3) {
          console.log('\n🔄 Changing back to normal mode (1000ms interval)...');
          tickerInstance.setInterval(1000);
          phase = 4;
        } else if (tick === 15) {
          console.log('\n🛑 Reached target tick count, stopping...');
          break;
        }
      }

      console.log(`\n✅ Total ticks received: ${totalTicks}`);
    } catch (error) {
      console.error('❌ Error in ticker receiver:', error.message);
    }
  });

  // Monitor ticker state
  go(async () => {
    let lastTickCount = 0;

    while (tickerInstance.getIsRunning()) {
      const currentTickCount = tickerInstance.getTickCount();
      const currentInterval = tickerInstance.getInterval();

      if (currentTickCount !== lastTickCount) {
        console.log(
          `📈 State: ${currentTickCount} ticks, ${currentInterval}ms interval`
        );
        lastTickCount = currentTickCount;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, 20000));

  tickerInstance.stop();
  console.log('\n🛑 Dynamic ticker stopped');
  console.log(`📊 Final statistics:`);
  console.log(`  Total ticks: ${tickerInstance.getTickCount()}`);
  console.log(`  Final interval: ${tickerInstance.getInterval()}ms`);
  console.log(`  Is running: ${tickerInstance.getIsRunning()}`);
}

// Run the example
dynamicTickerExample().catch(console.error);
