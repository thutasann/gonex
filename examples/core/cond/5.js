/* eslint-disable no-constant-condition */
// @ts-check
import {
  go,
  newCond,
  Mutex,
  sleep,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

// Example 5: Multi-threaded condition variable with worker threads
console.log(
  '🔔 Example 5: Multi-threaded condition variable with worker threads'
);

async function testCondWithWorkerThreads() {
  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 4,
    cpuAffinity: true,
    sharedMemory: true,
    timeout: 30000,
  });

  try {
    // Shared state in main thread
    const taskQueue = [];
    const completedTasks = [];
    let workersCompleted = 0;
    let allTasksProduced = false;

    const queueMutex = new Mutex({ name: 'queue-mutex' });
    const queueCond = newCond(queueMutex, { name: 'queue-condition' });

    console.log('   🚀 Starting multi-threaded condition variable demo...');

    // Task producer - runs in main thread using condition variables
    go(async () => {
      console.log('   📤 Producer: Creating tasks...');

      for (let i = 1; i <= 12; i++) {
        const task = {
          id: i,
          data: `Task-${i}`,
          complexity: Math.floor(Math.random() * 1000) + 500,
        };

        await queueMutex.lock();
        taskQueue.push(task);
        console.log(
          `   📤 Producer: Added ${task.data} (complexity: ${task.complexity})`
        );
        queueCond.signal(); // Wake up one waiting worker thread monitor
        queueMutex.unlock();

        await sleep(100);
      }

      console.log('   📤 Producer: All tasks created');

      // Mark all tasks as produced and signal coordinators
      await queueMutex.lock();
      allTasksProduced = true;
      console.log('   📤 Producer: Marking production complete');
      queueCond.broadcast(); // Wake up all waiting coordinators
      queueMutex.unlock();
    });

    // Worker thread coordinator - monitors queue and dispatches to worker threads
    go(async () => {
      console.log('   🎯 Coordinator: Starting task dispatch...');

      while (workersCompleted < 3) {
        await queueMutex.lock();

        while (taskQueue.length === 0 && !allTasksProduced) {
          console.log('   🎯 Coordinator: Waiting for tasks...');
          await queueCond.wait(); // Wait without timeout
        }

        if (taskQueue.length > 0) {
          const task = taskQueue.shift();
          queueMutex.unlock();

          console.log(
            `   🎯 Coordinator: Dispatching ${task.data} to worker thread`
          );

          // Send task to worker thread for CPU-intensive processing
          const result = await go(
            async taskData => {
              console.log(`   🔧 Worker Thread: Processing ${taskData.data}`);

              // Simulate CPU-intensive work in worker thread
              const startTime = Date.now();
              let computationResult = 0;

              for (let i = 0; i < taskData.complexity * 100; i++) {
                computationResult +=
                  Math.sqrt(i) * Math.sin(i / 1000) * Math.cos(i / 500);
              }

              const duration = Date.now() - startTime;

              console.log(
                `   🔧 Worker Thread: Completed ${taskData.data} in ${duration}ms`
              );

              return {
                ...taskData,
                result: computationResult.toFixed(4),
                processingTime: duration,
                threadId: `worker-${Math.floor(Math.random() * 1000)}`,
              };
            },
            [task],
            {
              useWorkerThreads: true,
              timeout: 15000,
            }
          );

          // Store completed task back in main thread
          await queueMutex.lock();
          completedTasks.push(result);
          console.log(
            `   ✅ Coordinator: Task ${result.data} completed and stored`
          );
          queueMutex.unlock();
        } else if (allTasksProduced && taskQueue.length === 0) {
          workersCompleted++;
          console.log(
            `   🎯 Coordinator: No more tasks, marking as completed (${workersCompleted}/3)`
          );
          queueCond.broadcast(); // Wake up other waiting coordinators
          queueMutex.unlock();
        } else {
          queueMutex.unlock();
        }
      }

      console.log('   🎯 Coordinator: All work dispatched');
    });

    // Additional worker coordinators for parallel processing
    for (let workerId = 2; workerId <= 3; workerId++) {
      go(async () => {
        console.log(`   🎯 Worker Coordinator ${workerId}: Starting...`);

        while (workersCompleted < 3) {
          await queueMutex.lock();

          while (taskQueue.length === 0 && !allTasksProduced) {
            console.log(
              `   🎯 Worker Coordinator ${workerId}: Waiting for tasks...`
            );
            await queueCond.wait(); // Wait without timeout
          }

          if (taskQueue.length > 0) {
            const task = taskQueue.shift();
            queueMutex.unlock();

            console.log(
              `   🎯 Worker Coordinator ${workerId}: Processing ${task.data} in worker thread`
            );

            // Process in worker thread
            const result = await go(
              async (taskData, coordinatorId) => {
                console.log(
                  `   🔧 Worker Thread (Coord ${coordinatorId}): Processing ${taskData.data}`
                );

                const startTime = Date.now();
                let computationResult = 0;

                // Different computation pattern for variety
                for (let i = 0; i < taskData.complexity * 80; i++) {
                  computationResult +=
                    Math.pow(Math.sqrt(i), 1.5) * Math.tan(i / 2000);
                }

                const duration = Date.now() - startTime;

                console.log(
                  `   🔧 Worker Thread (Coord ${coordinatorId}): Completed ${taskData.data} in ${duration}ms`
                );

                return {
                  ...taskData,
                  result: computationResult.toFixed(4),
                  processingTime: duration,
                  threadId: `worker-${coordinatorId}-${Math.floor(Math.random() * 1000)}`,
                  coordinatorId,
                };
              },
              [task, workerId],
              {
                useWorkerThreads: true,
                timeout: 15000,
              }
            );

            await queueMutex.lock();
            completedTasks.push(result);
            console.log(
              `   ✅ Worker Coordinator ${workerId}: Task ${result.data} completed`
            );
            queueMutex.unlock();
          } else if (allTasksProduced && taskQueue.length === 0) {
            workersCompleted++;
            console.log(
              `   🎯 Worker Coordinator ${workerId}: No more tasks (${workersCompleted}/3)`
            );
            queueCond.broadcast(); // Wake up other waiting coordinators
            queueMutex.unlock();
          } else {
            queueMutex.unlock();
          }
        }

        console.log(`   🎯 Worker Coordinator ${workerId}: Finished`);
      });
    }

    // Progress monitor
    go(async () => {
      const startTime = Date.now();

      while (workersCompleted < 3) {
        await sleep(1000);
        await queueMutex.lock();
        const queueSize = taskQueue.length;
        const completedSize = completedTasks.length;
        queueMutex.unlock();

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `   📊 Progress [${elapsed}s]: ${completedSize} completed, ${queueSize} pending, ${workersCompleted}/3 coordinators done`
        );
      }
    });

    // Wait for all work to complete
    console.log('   ⏳ Waiting for all work to complete...');

    // Wait until all tasks are processed
    while (true) {
      await queueMutex.lock();
      const queueSize = taskQueue.length;
      //   const completedSize = completedTasks.length;
      queueMutex.unlock();

      if (workersCompleted >= 3 && queueSize === 0) {
        console.log('   ✅ All coordinators finished and queue is empty');
        break;
      }

      await sleep(200);
    }

    // Final results
    await queueMutex.lock();
    const finalCompletedTasks = [...completedTasks];
    queueMutex.unlock();

    console.log('\n   📈 Final Results:');
    console.log(`   📊 Total tasks completed: ${finalCompletedTasks.length}`);

    // Show completed tasks
    console.log('\n   📋 Completed tasks:');
    finalCompletedTasks
      .sort((a, b) => a.id - b.id)
      .forEach((task, index) => {
        console.log(
          `   ${(index + 1).toString().padStart(2)}. ${task.data}: ${task.result.substring(0, 10)}... (${task.processingTime}ms, ${task.threadId})`
        );
      });

    // Performance statistics
    const totalProcessingTime = finalCompletedTasks.reduce(
      (sum, task) => sum + task.processingTime,
      0
    );
    const avgProcessingTime = totalProcessingTime / finalCompletedTasks.length;

    console.log('\n   📈 Performance Statistics:');
    console.log(`   ⏱️  Total processing time: ${totalProcessingTime}ms`);
    console.log(
      `   📊 Average processing time: ${avgProcessingTime.toFixed(2)}ms`
    );
    console.log(
      `   📊 Fastest task: ${Math.min(...finalCompletedTasks.map(t => t.processingTime))}ms`
    );
    console.log(
      `   📊 Slowest task: ${Math.max(...finalCompletedTasks.map(t => t.processingTime))}ms`
    );

    // Thread distribution
    const threadDistribution = finalCompletedTasks.reduce((acc, task) => {
      const coordinatorId = task.coordinatorId || 1;
      acc[`Coordinator ${coordinatorId}`] =
        (acc[`Coordinator ${coordinatorId}`] || 0) + 1;
      return acc;
    }, {});
    console.log(`   🔄 Coordinator distribution:`, threadDistribution);
  } catch (error) {
    console.error(
      '   ❌ Error in multi-threaded condition variable demo:',
      error
    );
  } finally {
    // Shutdown parallel scheduler
    await shutdownParallelScheduler();
    console.log('   🔧 Parallel scheduler shutdown complete');
  }
}

// Run the test
testCondWithWorkerThreads().catch(console.error);
