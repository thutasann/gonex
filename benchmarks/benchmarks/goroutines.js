// @ts-check
import {
  go,
  goAll,
  goRace,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../dist/index.js';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Utility function to measure execution time
 */
function measureTime(fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { result, duration: end - start };
}

/**
 * Utility function to run a benchmark multiple times and get statistics
 */
async function runBenchmark(name, fn, iterations = 5) {
  const spinner = ora(`Running ${name}...`).start();
  const times = [];

  try {
    for (let i = 0; i < iterations; i++) {
      const { duration } = await measureTime(fn);
      times.push(duration);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const stdDev = Math.sqrt(
      times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) /
        times.length
    );

    spinner.succeed(`${name} completed`);
    return {
      name,
      iterations,
      average: avg,
      min,
      max,
      stdDev,
      times,
    };
  } catch (error) {
    spinner.fail(`${name} failed: ${error.message}`);
    throw error;
  }
}

/**
 * CPU-intensive task for testing true parallelism
 */
function cpuIntensiveTask(iterations = 1000000) {
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) + Math.pow(i, 0.5);
  }
  return result;
}

/**
 * I/O simulation task
 */
async function ioSimulationTask(delay = 100) {
  await new Promise(resolve => setTimeout(resolve, delay));
  return 'io-completed';
}

/**
 * Benchmark: Simple goroutine creation and execution
 */
async function benchmarkSimpleGoroutine() {
  return runBenchmark('Simple Goroutine', async () => {
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(go(() => i * 2));
    }
    await Promise.all(promises);
  });
}

/**
 * Benchmark: Goroutine with async operations
 */
async function benchmarkAsyncGoroutine() {
  return runBenchmark('Async Goroutine', async () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        go(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return `async-${i}`;
        })
      );
    }
    await Promise.all(promises);
  });
}

/**
 * Benchmark: Event-loop vs Worker-thread performance for CPU-intensive tasks
 */
async function benchmarkCpuIntensiveComparison() {
  const tasks = Array.from({ length: 4 }, () => () => cpuIntensiveTask(500000));

  const eventLoopBenchmark = runBenchmark(
    'CPU-Intensive (Event-Loop)',
    async () => {
      await goAll(tasks, { useWorkerThreads: false });
    }
  );

  const workerThreadBenchmark = runBenchmark(
    'CPU-Intensive (Worker-Threads)',
    async () => {
      await goAll(tasks, {
        useWorkerThreads: true,
      });
    }
  );

  return {
    eventLoop: await eventLoopBenchmark,
    workerThread: await workerThreadBenchmark,
  };
}

/**
 * Benchmark: goAll performance with different task counts
 */
async function benchmarkGoAllScaling() {
  const results = {};
  const taskCounts = [10, 50, 100, 200];

  for (const taskCount of taskCounts) {
    const tasks = Array.from(
      { length: taskCount },
      (_, i) => () => `task-${i}`
    );

    const eventLoopResult = await runBenchmark(
      `goAll ${taskCount} tasks (Event-Loop)`,
      async () => {
        await goAll(tasks, { useWorkerThreads: false });
      }
    );

    const workerThreadResult = await runBenchmark(
      `goAll ${taskCount} tasks (Worker-Threads)`,
      async () => {
        await goAll(tasks, {
          useWorkerThreads: true,
        });
      }
    );

    results[taskCount] = {
      eventLoop: eventLoopResult,
      workerThread: workerThreadResult,
    };
  }

  return results;
}

/**
 * Benchmark: goRace performance
 */
async function benchmarkGoRace() {
  const tasks = Array.from(
    { length: 10 },
    (_, i) => () =>
      new Promise(resolve =>
        setTimeout(() => resolve(`race-${i}`), Math.random() * 100)
      )
  );

  return runBenchmark('goRace', async () => {
    await goRace(tasks);
  });
}

/**
 * Benchmark: goWithRetry performance
 */
// async function benchmarkGoWithRetry() {
//   let failCount = 0;
//   const failingTask = () => {
//     failCount++;
//     if (failCount <= 2) {
//       throw new Error('Simulated failure');
//     }
//     return 'success';
//   };

//   return runBenchmark('goWithRetry', async () => {
//     failCount = 0;
//     try {
//       await goWithRetry(failingTask, 3, 50);
//     } catch (_error) {
//       // Expected error for the first few attempts
//       if (failCount <= 2) {
//         // This is expected behavior
//         return;
//       }
//       throw _error;
//     }
//   });
// }

/**
 * Benchmark: Memory usage and garbage collection
 */
async function benchmarkMemoryUsage() {
  const initialMemory = process.memoryUsage();

  const result = await runBenchmark('Memory Usage Test', async () => {
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(
        go(() => {
          const data = new Array(1000).fill(Math.random());
          return data.reduce((a, b) => a + b, 0);
        })
      );
    }
    await Promise.all(promises);
  });

  const finalMemory = process.memoryUsage();
  const memoryDiff = {
    heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
    heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
    external: finalMemory.external - initialMemory.external,
  };

  return { ...result, memoryDiff };
}

/**
 * Benchmark: Error handling performance
 */
// async function benchmarkErrorHandling() {
//   const errorTask = () => {
//     throw new Error('Benchmark error');
//   };

//   return runBenchmark('Error Handling', async () => {
//     const promises = [];
//     for (let i = 0; i < 100; i++) {
//       promises.push(
//         go(errorTask, {
//           onError: () => {
//             // Error handler
//           },
//         }).catch(() => {
//           // Expected error
//         })
//       );
//     }
//     await Promise.all(promises);
//   });
// }

/**
 * Benchmark: Mixed workload (CPU + I/O)
 */
async function benchmarkMixedWorkload() {
  const cpuTasks = Array.from(
    { length: 2 },
    () => () => cpuIntensiveTask(200000)
  );
  const ioTasks = Array.from({ length: 3 }, () => async () => {
    const result = await ioSimulationTask(50);
    return result.length; // Return a number to match CPU tasks
  });

  const eventLoopResult = await runBenchmark(
    'Mixed Workload (Event-Loop)',
    async () => {
      await goAll([...cpuTasks, ...ioTasks], {
        useWorkerThreads: false,
      });
    }
  );

  return {
    eventLoop: eventLoopResult,
  };
}

/**
 * Run all goroutine benchmarks
 */
export async function runGoroutineBenchmarks() {
  console.log(chalk.blue('🔄 Initializing parallel scheduler...'));
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 4,
    cpuAffinity: true,
    sharedMemory: true,
    timeout: 60000, // Increased timeout to 60 seconds
  });

  try {
    const results = {};

    // Basic functionality benchmarks
    console.log(chalk.yellow('\n📊 Basic Functionality Benchmarks:'));
    results.simple = await benchmarkSimpleGoroutine();
    results.async = await benchmarkAsyncGoroutine();
    results.goRace = await benchmarkGoRace();
    // results.goWithRetry = await benchmarkGoWithRetry();
    // results.errorHandling = await benchmarkErrorHandling();

    // Performance comparison benchmarks
    console.log(chalk.yellow('\n⚡ Performance Comparison Benchmarks:'));
    results.cpuIntensive = await benchmarkCpuIntensiveComparison();
    results.mixedWorkload = await benchmarkMixedWorkload();

    // Scaling benchmarks
    console.log(chalk.yellow('\n📈 Scaling Benchmarks:'));
    results.goAllScaling = await benchmarkGoAllScaling();

    // Memory benchmarks
    console.log(chalk.yellow('\n💾 Memory Usage Benchmarks:'));
    results.memoryUsage = await benchmarkMemoryUsage();

    return results;
  } finally {
    console.log(chalk.blue('\n🔄 Shutting down parallel scheduler...'));
    await shutdownParallelScheduler();
  }
}
