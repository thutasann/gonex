/* eslint-disable no-constant-condition */
// @ts-check

/**
 * Simple Multi-Thread Goroutines with Channel Communication
 *
 * This example demonstrates:
 * - Worker threads processing tasks in parallel
 * - Channel communication between goroutines
 * - True parallelism with useWorkerThreads: true
 */
import {
  go,
  channel,
  waitGroup,
  sleep,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

// Initialize Parallel Scheduler
await initializeParallelScheduler({
  useWorkerThreads: true,
  threadCount: 4,
  cpuAffinity: true,
  sharedMemory: true,
  timeout: 60000, // Increased timeout to 60 seconds
});

const heavyTask = async data => {
  let result = 0;
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    for (let j = 0; j < 1000; j++) {
      result += Math.sqrt(j) * Math.pow(j, 0.1);
    }
  }
  return { taskId: data.id, result: result.toFixed(2) };
};

// Multi-Thread Goroutines with Channel Communication:
const taskChannel = channel({
  bufferSize: 3,
  name: 'taskChannel',
});
const resultChannel = channel({
  bufferSize: 3,
  name: 'resultChannel',
  timeout: 10000, // Increased timeout to 10 seconds
});
const wg = waitGroup();

// Producer: Send tasks
go(async () => {
  console.log('   📤 Producer: Sending tasks...');

  for (let i = 1; i <= 4; i++) {
    await taskChannel.send({ id: i, data: `task-${i}` });
    console.log(`   📤 Sent task ${i}`);
    await sleep(50); // Reduced delay
  }

  taskChannel.close();
  console.log('   📋 Producer: All tasks sent');
});

// Worker 1: Process tasks using worker thread
wg.add(1);
go(async () => {
  console.log('   🔧 Worker 1: Started');

  try {
    while (true) {
      const task = await taskChannel.receive();
      if (!task) {
        console.log('   🔚 Worker 1: Channel closed');
        break;
      }

      console.log(`   🔧 Worker 1: Processing task ${task.id}...`);

      // Use worker thread for CPU-intensive work with task data passed as parameter
      const result = await go(
        async (taskData, heavyTaskFn) => {
          return await heavyTaskFn(taskData);
        },
        [task, heavyTask],
        {
          useWorkerThreads: true,
        }
      );

      // Send the result to the result channel
      console.log(`   📤 Worker 1: Sending result for task ${task.id}`);
      await resultChannel.send({
        workerId: 1,
        ...result,
        originalTask: task,
      });
      console.log(`   📤 Worker 1: Result sent for task ${task.id}`);

      console.log(
        `   ✅ Worker 1: Completed task ${task.id} (Result: ${result.result})`
      );
    }
  } catch (error) {
    console.log(`   ❌ Worker 1: Error - ${error.message}`);
  } finally {
    wg.done();
  }
});

// Worker 2: Process tasks using worker thread
wg.add(1);
go(async () => {
  console.log('   🔧 Worker 2: Started');

  try {
    while (true) {
      const task = await taskChannel.receive();
      if (!task) {
        console.log('   🔚 Worker 2: Channel closed');
        break;
      }

      console.log(`   🔧 Worker 2: Processing task ${task.id}...`);

      // Use worker thread for CPU-intensive work with task data passed as parameter
      const result = await go(
        async (taskData, heavyTaskFn) => {
          return await heavyTaskFn(taskData);
        },
        [task, heavyTask],
        {
          useWorkerThreads: true,
        }
      );

      // Send the result to the result channel
      console.log(`   📤 Worker 2: Sending result for task ${task.id}`);
      await resultChannel.send({
        workerId: 2,
        ...result,
        originalTask: task,
      });
      console.log(`   📤 Worker 2: Result sent for task ${task.id}`);

      console.log(
        `   ✅ Worker 2: Completed task ${task.id} (Result: ${result.result})`
      );
    }
  } catch (error) {
    console.log(`   ❌ Worker 2: Error - ${error.message}`);
  } finally {
    wg.done();
  }
});

// Result Collector - Start immediately to collect results as they come
const results = [];
go(async () => {
  console.log('   📊 Result Collector: Started');

  try {
    while (true) {
      console.log('   📊 Result Collector: Waiting for result...');
      const result = await resultChannel.receive();
      console.log('   📊 Result Collector: Received result:', result);
      if (!result) {
        console.log(
          '   📊 Result Collector: Channel closed, stopping collection'
        );
        break;
      }
      results.push(result);
      console.log(
        `   📊 Result Collector: Collected ${results.length} results so far`
      );
    }
  } catch (error) {
    console.log(
      `   📊 Collected ${results.length} results, error:`,
      error.message
    );
  }
});

// Wait for all workers to finish, then close channel and show results
go(async () => {
  console.log('   📋 Waiting for all workers to finish...');

  // Wait for all workers to finish processing
  await wg.wait();
  console.log('   📋 All workers finished processing');

  // Give a small delay to ensure all results are sent
  await sleep(100);

  // Now close the result channel
  resultChannel.close();
  console.log('   📋 Result channel closed');

  // Wait a bit more for result collection to complete
  await sleep(200);

  console.log('\n   📊 Final Results:');
  results.forEach((result, index) => {
    console.log(
      `   ${index + 1}. Worker ${result.workerId}: Task ${result.taskId} = ${result.result}`
    );
  });

  // Shutdown parallel scheduler after all tasks are completed
  await shutdownParallelScheduler();
  console.log('   🔧 Parallel Scheduler shutdown complete');
});

console.log(
  '\n🚀 Multi-thread goroutines with channels started. Waiting for completion...\n'
);
