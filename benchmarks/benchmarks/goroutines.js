// @ts-check
import {
  go,
  goAll,
  goRace,
  initializeParallelScheduler,
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
  const tasks = Array.from(
    { length: 4 },
    () => iterations => cpuIntensiveTask(iterations)
  );

  const eventLoopBenchmark = runBenchmark(
    'CPU-Intensive (Event-Loop)',
    async () => {
      await goAll(tasks, [[500000], [500000], [500000], [500000]], {
        useWorkerThreads: false,
      });
    }
  );

  const workerThreadBenchmark = runBenchmark(
    'CPU-Intensive (Worker-Threads)',
    async () => {
      await goAll(tasks, [[500000], [500000], [500000], [500000]], {
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
      () => taskId => `task-${taskId}`
    );

    const args = Array.from({ length: taskCount }, () => []);

    const eventLoopResult = await runBenchmark(
      `goAll ${taskCount} tasks (Event-Loop)`,
      async () => {
        await goAll(tasks, args, { useWorkerThreads: false });
      }
    );

    const workerThreadResult = await runBenchmark(
      `goAll ${taskCount} tasks (Worker-Threads)`,
      async () => {
        await goAll(tasks, args, {
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
    (_, i) => delay =>
      new Promise(resolve => setTimeout(() => resolve(`race-${i}`), delay))
  );

  const args = Array.from({ length: 10 }, () => [Math.random() * 100]);

  return runBenchmark('goRace', async () => {
    await goRace(tasks, args);
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
//       await goWithRetry(failingTask, [], 3, 50);
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
//         go(errorTask, [], {
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
 * Benchmark: External dependencies usage (lodash)
 */
async function benchmarkExternalDependencies() {
  const lodashTasks = Array.from({ length: 4 }, () => async dataSize => {
    const lodash = await import('lodash');
    const _ = lodash.default;

    // Generate random data
    const numbers = Array.from(
      { length: dataSize },
      () => Math.random() * 1000
    );
    const objects = Array.from({ length: dataSize }, (_, i) => ({
      id: i,
      value: Math.random() * 100,
      category: Math.floor(Math.random() * 5),
    }));

    // Perform various lodash operations
    const sum = _.sum(numbers);
    const mean = _.mean(numbers);
    const max = _.max(numbers);
    const min = _.min(numbers);
    const chunked = _.chunk(numbers, Math.ceil(dataSize / 10));
    const unique = _.uniq(numbers.map(n => Math.floor(n / 100)));
    const shuffled = _.shuffle(numbers).slice(0, 100);
    const grouped = _.groupBy(objects, 'category');
    const sorted = _.sortBy(objects, 'value');
    const filtered = _.filter(objects, obj => obj.value > 50);

    return {
      sum,
      mean,
      max,
      min,
      chunkCount: chunked.length,
      uniqueCount: unique.length,
      shuffledCount: shuffled.length,
      groupCount: Object.keys(grouped).length,
      sortedCount: sorted.length,
      filteredCount: filtered.length,
    };
  });

  const eventLoopResult = await runBenchmark(
    'External Dependencies (Event-Loop)',
    async () => {
      await goAll(lodashTasks, [[10000], [10000], [10000], [10000]], {
        useWorkerThreads: false,
      });
    }
  );

  const workerThreadResult = await runBenchmark(
    'External Dependencies (Worker-Threads)',
    async () => {
      await goAll(lodashTasks, [[10000], [10000], [10000], [10000]], {
        useWorkerThreads: true,
      });
    }
  );

  return {
    eventLoop: eventLoopResult,
    workerThread: workerThreadResult,
  };
}

/**
 * Benchmark: Advanced external dependencies usage (lodash only)
 */
async function benchmarkAdvancedExternalDependencies() {
  const tasks = [
    // Basic lodash operations
    async dataSize => {
      const lodash = await import('lodash');
      const _ = lodash.default;
      const numbers = Array.from(
        { length: dataSize },
        () => Math.random() * 1000
      );
      return {
        package: 'lodash-basic',
        sum: _.sum(numbers),
        mean: _.mean(numbers),
        max: _.max(numbers),
        operations: 3,
      };
    },
    // Advanced lodash operations
    async dataSize => {
      const lodash = await import('lodash');
      const _ = lodash.default;
      const objects = Array.from({ length: dataSize }, (_, i) => ({
        id: i,
        value: Math.random() * 100,
        category: Math.floor(Math.random() * 5),
      }));
      const values = objects.map(obj => obj.value);
      return {
        package: 'lodash-advanced',
        sum: _.sum(values),
        mean: _.mean(values),
        max: _.max(values),
        operations: 3,
      };
    },
    // Complex lodash operations
    async dataSize => {
      const lodash = await import('lodash');
      const _ = lodash.default;
      const data = Array.from({ length: dataSize }, () => Math.random() * 1000);
      return {
        package: 'lodash-complex',
        sum: _.sum(data),
        mean: _.mean(data),
        max: _.max(data),
        operations: 3,
      };
    },
  ];

  const eventLoopResult = await runBenchmark(
    'Advanced External Dependencies (Event-Loop)',
    async () => {
      await goAll(tasks, [[5000], [5000], [5000]], {
        useWorkerThreads: false,
      });
    }
  );

  const workerThreadResult = await runBenchmark(
    'Advanced External Dependencies (Worker-Threads)',
    async () => {
      await goAll(tasks, [[5000], [5000], [5000]], {
        useWorkerThreads: true,
      });
    }
  );

  return {
    eventLoop: eventLoopResult,
    workerThread: workerThreadResult,
  };
}

/**
 * Benchmark: Mixed workload (CPU + I/O)
 */
async function benchmarkMixedWorkload() {
  const cpuTasks = Array.from(
    { length: 2 },
    () => iterations => cpuIntensiveTask(iterations)
  );
  const ioTasks = Array.from({ length: 3 }, () => async delay => {
    const result = await ioSimulationTask(delay);
    return result.length; // Return a number to match CPU tasks
  });

  const eventLoopResult = await runBenchmark(
    'Mixed Workload (Event-Loop)',
    async () => {
      await goAll(
        [...cpuTasks, ...ioTasks],
        [
          [200000],
          [200000], // CPU tasks
          [50],
          [50],
          [50], // I/O tasks
        ],
        {
          useWorkerThreads: false,
        }
      );
    }
  );

  const workerThreadResult = await runBenchmark(
    'Mixed Workload (Worker-Threads)',
    async () => {
      await goAll(
        [...cpuTasks, ...ioTasks],
        [
          [200000],
          [200000], // CPU tasks
          [50],
          [50],
          [50], // I/O tasks
        ],
        {
          useWorkerThreads: true,
        }
      );
    }
  );

  return {
    eventLoop: eventLoopResult,
    workerThread: workerThreadResult,
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
    loadBalancing: 'least-busy',
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
    results.externalDependencies = await benchmarkExternalDependencies();
    results.advancedExternalDependencies =
      await benchmarkAdvancedExternalDependencies();

    // Scaling benchmarks
    console.log(chalk.yellow('\n📈 Scaling Benchmarks:'));
    results.goAllScaling = await benchmarkGoAllScaling();

    // Memory benchmarks
    console.log(chalk.yellow('\n💾 Memory Usage Benchmarks:'));
    results.memoryUsage = await benchmarkMemoryUsage();

    return results;
  } catch (error) {
    console.error(chalk.red('❌ Benchmark suite failed:'), error);
    process.exit(1);
  }
}
