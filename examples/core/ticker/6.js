/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  ticker,
  channel,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

// Example 6: Ticker with worker threads for CPU-intensive processing
async function tickerWorkerExample() {
  try {
    // Initialize worker thread scheduler
    await initializeParallelScheduler({
      useWorkerThreads: true,
      threadCount: 3,
    });

    console.log('🕐 Example 6: Ticker with Worker Threads');
    console.log(
      'Demonstrating CPU-intensive periodic tasks in worker threads...\n'
    );

    // Create channels for data flow
    const dataChannel = channel({ bufferSize: 20, name: 'DataFlow' });
    const resultsChannel = channel({ bufferSize: 10, name: 'Results' });

    // Create ticker for periodic data generation
    const dataTicker = ticker({ interval: 500, name: 'DataTicker' });
    const tickerChannel = dataTicker.start();

    console.log('✅ System initialized with worker threads');
    console.log('  - Data generation: every 500ms');
    console.log('  - Processing: CPU-intensive tasks in worker threads\n');

    // Data generator (runs in main thread to manage ticker)
    go(async () => {
      let dataCount = 0;

      try {
        while (dataCount < 10) {
          // Run for 10 iterations
          const tick = await tickerChannel.receive();
          if (tick === undefined) break;

          dataCount++;
          const workData = {
            id: dataCount,
            timestamp: Date.now(),
            numbers: Array.from({ length: 1000 }, () =>
              Math.floor(Math.random() * 1000)
            ),
            operation: Math.random() > 0.5 ? 'sort' : 'sum',
          };

          await dataChannel.send(workData);
          console.log(
            `📝 Generated work item ${dataCount}: ${workData.operation} operation on ${workData.numbers.length} numbers`
          );
        }

        // Signal completion
        dataChannel.close();
      } catch (error) {
        console.error('❌ Data generation error:', error.message);
      }
    });

    // Worker function for CPU-intensive data processing
    const processWorkData = async workData => {
      const { performance } = require('perf_hooks');
      const startTime = performance.now();

      let result;
      if (workData.operation === 'sort') {
        // CPU-intensive sorting
        result = {
          id: workData.id,
          operation: 'sort',
          sortedNumbers: [...workData.numbers].sort((a, b) => a - b),
          processingTime: 0,
          processedBy: 'Worker-Thread',
        };
      } else {
        // CPU-intensive sum calculation with extra work
        let sum = 0;
        for (let i = 0; i < workData.numbers.length; i++) {
          sum += workData.numbers[i];
          // Add some CPU work to make it more intensive
          for (let j = 0; j < 100; j++) {
            Math.sqrt(workData.numbers[i] * j);
          }
        }
        result = {
          id: workData.id,
          operation: 'sum',
          sum: sum,
          average: sum / workData.numbers.length,
          processingTime: 0,
          processedBy: 'Worker-Thread',
        };
      }

      const endTime = performance.now();
      result.processingTime = Number((endTime - startTime).toFixed(2));

      return result;
    };

    // Data processor (main thread coordinates work distribution)
    go(async () => {
      try {
        while (true) {
          const workData = await dataChannel.receive();
          if (workData === undefined) break;

          // Process work in worker thread
          const result = await go(processWorkData, [workData], {
            useWorkerThreads: true,
          });

          // Send result to aggregation
          await resultsChannel.send(result);
          console.log(
            `⚙️  Processed item ${result.id}: ${result.operation} (${result.processingTime}ms)`
          );
        }
      } catch (error) {
        console.error('❌ Data processing coordinator error:', error.message);
      }
    });

    // Results aggregation and statistics (main thread)
    go(async () => {
      let totalProcessed = 0;
      let totalProcessingTime = 0;
      const operationCounts = { sort: 0, sum: 0 };

      try {
        while (true) {
          const result = await resultsChannel.receive();
          if (result === undefined) break;

          totalProcessed++;
          operationCounts[result.operation]++;

          // Parse processing time
          const timeMs = Number(result.processingTime);
          totalProcessingTime += timeMs;

          console.log(`📊 Worker-2 aggregated result ${result.id}:`);
          console.log(`    Operation: ${result.operation}`);
          console.log(`    Processed by: ${result.processedBy}`);
          console.log(`    Processing time: ${result.processingTime}`);

          if (result.operation === 'sort') {
            console.log(
              `    First 5 sorted: [${result.sortedNumbers.slice(0, 5).join(', ')}...]`
            );
          } else {
            console.log(
              `    Sum: ${result.sum}, Average: ${result.average.toFixed(2)}`
            );
          }

          // Show running statistics
          const avgTime = (totalProcessingTime / totalProcessed).toFixed(2);
          console.log(
            `    📈 Stats: ${totalProcessed} processed, avg time: ${avgTime}ms`
          );
          console.log('');
        }

        // Final statistics
        console.log('🏁 Final Statistics:');
        console.log(`  Total items processed: ${totalProcessed}`);
        console.log(`  Sort operations: ${operationCounts.sort}`);
        console.log(`  Sum operations: ${operationCounts.sum}`);
        console.log(
          `  Average processing time: ${(totalProcessingTime / totalProcessed).toFixed(2)}ms`
        );
        console.log(
          `  Total processing time: ${totalProcessingTime.toFixed(2)}ms`
        );
      } catch (error) {
        console.error('❌ Results aggregation error:', error.message);
      }
    });

    console.log('🔄 Processing started...\n');

    // Wait for processing to complete (10 items * 500ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Cleanup
    dataTicker.stop();
    resultsChannel.close();

    console.log('\n🛑 Ticker processing stopped');
    console.log(
      `📊 Ticker statistics: ${dataTicker.getTickCount()} ticks generated`
    );
  } catch (error) {
    console.error('❌ Error in tickerWorkerExample:', error);
  } finally {
    await shutdownParallelScheduler();
  }
}

tickerWorkerExample().catch(console.error);
