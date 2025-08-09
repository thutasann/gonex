/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  waitGroup,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

// Example 6: WaitGroup with worker threads for coordinated parallel execution
async function waitGroupWorkerExample() {
  try {
    // Initialize worker thread scheduler
    await initializeParallelScheduler({
      useWorkerThreads: true,
      threadCount: 4,
    });

    console.log('🔄 Example 6: WaitGroup with Worker Threads');
    console.log('Demonstrating coordinated parallel task execution...\n');

    // Example 1: Parallel data processing with waitgroup coordination
    console.log('📊 Example 1: Parallel Data Processing');
    const dataProcessingWg = waitGroup();
    const tasks = [
      {
        id: 1,
        data: Array.from({ length: 1000 }, (_, i) => i),
        operation: 'sum',
      },
      {
        id: 2,
        data: Array.from({ length: 500 }, (_, i) => i * 2),
        operation: 'average',
      },
      {
        id: 3,
        data: Array.from({ length: 800 }, (_, i) => Math.random() * 100),
        operation: 'sort',
      },
      {
        id: 4,
        data: Array.from({ length: 600 }, (_, i) => i * i),
        operation: 'filter',
      },
    ];

    // CPU-intensive data processing function
    const processData = async task => {
      const { performance } = require('perf_hooks');
      const startTime = performance.now();

      /** @type {any} */
      let result;
      switch (task.operation) {
        case 'sum':
          result = {
            id: task.id,
            operation: 'sum',
            result: task.data.reduce((sum, num) => sum + num, 0),
          };
          break;
        case 'average':
          const sum = task.data.reduce((sum, num) => sum + num, 0);
          result = {
            id: task.id,
            operation: 'average',
            result: sum / task.data.length,
          };
          break;
        case 'sort':
          result = {
            id: task.id,
            operation: 'sort',
            result: [...task.data].sort((a, b) => a - b).slice(0, 10), // First 10 sorted
          };
          break;
        case 'filter':
          result = {
            id: task.id,
            operation: 'filter',
            result: task.data.filter(num => num > 100).length,
          };
          break;
      }

      const endTime = performance.now();
      result.processingTime = (endTime - startTime).toFixed(2);
      result.processedBy = 'Worker-Thread';

      return result;
    };

    // Start parallel processing tasks
    dataProcessingWg.add(tasks.length);
    const results = [];

    for (const task of tasks) {
      go(async () => {
        try {
          const result = await go(processData, [task], {
            useWorkerThreads: true,
          });
          results.push(result);
          console.log(
            `✅ Task ${result.id} (${result.operation}) completed in ${result.processingTime}ms`
          );
          dataProcessingWg.done();
        } catch (error) {
          console.error(`❌ Task ${task.id} failed:`, error.message);
          dataProcessingWg.done();
        }
      });
    }

    // Wait for all data processing tasks to complete
    await dataProcessingWg.wait();
    console.log(`📈 All ${tasks.length} data processing tasks completed!\n`);

    // Display results
    results.sort((a, b) => a.id - b.id);
    results.forEach(result => {
      console.log(
        `   Task ${result.id}: ${result.operation} = ${JSON.stringify(result.result).slice(0, 50)}...`
      );
    });
    console.log('');

    // Example 2: Batch processing with nested waitgroups
    console.log('🔄 Example 2: Batch Processing with Nested WaitGroups');
    const batchWg = waitGroup();
    const batches = [
      { batchId: 'A', items: 5 },
      { batchId: 'B', items: 3 },
      { batchId: 'C', items: 4 },
    ];

    // Intensive computation function
    const intensiveComputation = async (batchId, itemId) => {
      const { performance } = require('perf_hooks');
      const startTime = performance.now();

      // Simulate CPU-intensive work
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i * Math.random());
      }

      const endTime = performance.now();
      return {
        batchId,
        itemId,
        result: result.toFixed(2),
        processingTime: (endTime - startTime).toFixed(2),
      };
    };

    batchWg.add(batches.length);

    for (const batch of batches) {
      go(async () => {
        try {
          console.log(
            `🚀 Starting batch ${batch.batchId} with ${batch.items} items`
          );

          // Inner waitgroup for batch items
          const itemWg = waitGroup();
          const batchResults = [];

          itemWg.add(batch.items);

          for (let i = 1; i <= batch.items; i++) {
            go(async () => {
              try {
                const result = await go(
                  intensiveComputation,
                  [batch.batchId, i],
                  { useWorkerThreads: true }
                );
                batchResults.push(result);
                console.log(
                  `   ✓ Batch ${batch.batchId} Item ${i} completed (${result.processingTime}ms)`
                );
                itemWg.done();
              } catch (error) {
                console.error(
                  `   ❌ Batch ${batch.batchId} Item ${i} failed:`,
                  error.message
                );
                itemWg.done();
              }
            });
          }

          // Wait for all items in this batch
          await itemWg.wait();

          const avgTime = (
            batchResults.reduce(
              (sum, r) => sum + parseFloat(r.processingTime),
              0
            ) / batchResults.length
          ).toFixed(2);
          console.log(
            `🏁 Batch ${batch.batchId} completed! Average time: ${avgTime}ms\n`
          );

          batchWg.done();
        } catch (error) {
          console.error(`❌ Batch ${batch.batchId} failed:`, error.message);
          batchWg.done();
        }
      });
    }

    // Wait for all batches to complete
    await batchWg.wait();
    console.log('🎉 All batches completed!\n');

    // Example 3: Error handling with waitgroups
    console.log('⚠️  Example 3: Error Handling with WaitGroups');
    const errorHandlingWg = waitGroup();
    const errorTasks = [
      { id: 1, shouldFail: false, workload: 100 },
      { id: 2, shouldFail: true, workload: 200 }, // This will fail
      { id: 3, shouldFail: false, workload: 150 },
      { id: 4, shouldFail: false, workload: 80 },
    ];

    const errorProneTask = async task => {
      const { performance } = require('perf_hooks');
      const startTime = performance.now();

      if (task.shouldFail) {
        throw new Error(`Simulated failure in task ${task.id}`);
      }

      // Simulate work
      let result = 0;
      for (let i = 0; i < task.workload * 1000; i++) {
        result += Math.sqrt(i);
      }

      const endTime = performance.now();
      return {
        id: task.id,
        result: result.toFixed(2),
        processingTime: (endTime - startTime).toFixed(2),
      };
    };

    errorHandlingWg.add(errorTasks.length);
    let successCount = 0;
    let errorCount = 0;

    for (const task of errorTasks) {
      go(async () => {
        try {
          const result = await go(errorProneTask, [task], {
            useWorkerThreads: true,
          });
          successCount++;
          console.log(
            `✅ Error task ${result.id} succeeded (${result.processingTime}ms)`
          );
        } catch (error) {
          errorCount++;
          console.log(`❌ Error task ${task.id} failed: ${error.message}`);
        } finally {
          errorHandlingWg.done();
        }
      });
    }

    await errorHandlingWg.wait();
    console.log(
      `📊 Error handling complete: ${successCount} succeeded, ${errorCount} failed\n`
    );

    console.log('🏁 All WaitGroup + Worker Thread examples completed!');
  } catch (error) {
    console.error('❌ Error in waitGroupWorkerExample:', error);
  } finally {
    await shutdownParallelScheduler();
  }
}

waitGroupWorkerExample().catch(console.error);
