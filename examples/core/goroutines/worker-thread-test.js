// @ts-check
import {
  go,
  goAll,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

async function testWorkerThreads() {
  console.log('Testing worker thread functionality...');

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Test 1: Simple function execution
    console.log('\n1. Testing simple function execution...');
    const result1 = await go(
      () => {
        console.log('Executing in worker thread');
        return 'Hello from worker thread!';
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Result:', result1);

    // Test 2: Function with arguments
    console.log('\n2. Testing function with arguments...');
    const result2 = await go(
      (a, b) => {
        console.log('Executing with arguments:', a, b);
        return a + b;
      },
      [5, 10],
      { useWorkerThreads: true }
    );
    console.log('Result:', result2);

    // Test 3: Heavy computation with arguments
    console.log('\n3. Testing heavy computation...');
    const result3 = await go(
      iterations => {
        console.log(
          'Starting heavy computation with',
          iterations,
          'iterations...'
        );
        let sum = 0;
        for (let i = 0; i < iterations; i++) {
          sum += Math.sqrt(i);
        }
        console.log('Heavy computation completed');
        return sum;
      },
      [100000],
      { useWorkerThreads: true }
    );
    console.log('Heavy computation result:', result3);

    // Test 4: Function with function argument
    console.log('\n4. Testing function with function argument...');
    const heavyTask = data => {
      console.log('Executing heavyTask with data:', data);
      let result = 0;
      for (let i = 0; i < 10000; i++) {
        result += Math.sqrt(i) * data;
      }
      return result;
    };

    const result4 = await go(
      async (task, data) => {
        console.log('Executing in worker thread with task and data:', data);
        return await task(data);
      },
      [heavyTask, 5],
      { useWorkerThreads: true }
    );
    console.log('Function with function argument result:', result4);

    // Test 5: Multiple concurrent executions
    console.log('\n5. Testing multiple concurrent executions...');
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        go(
          (workerId, iterations) => {
            console.log(`Worker ${workerId} starting...`);
            const start = Date.now();
            // Simulate some work
            let sum = 0;
            for (let j = 0; j < iterations; j++) {
              sum += Math.sqrt(j);
            }
            const duration = Date.now() - start;
            console.log(`Worker ${workerId} completed in ${duration}ms`);
            return { workerId, result: sum, duration };
          },
          [i, 50000],
          { useWorkerThreads: true }
        )
      );
    }

    const results = await Promise.all(promises);
    console.log('All workers completed:', results);

    // Test 6: Error handling
    console.log('\n6. Testing error handling...');
    try {
      await go(
        message => {
          throw new Error(`Test error from worker thread: ${message}`);
        },
        ['Hello Error'],
        { useWorkerThreads: true }
      );
    } catch (error) {
      console.log('Caught error:', error.message);
    }

    // Test 7: goAll with arguments
    console.log('\n7. Testing goAll with arguments...');
    const functions = [x => x * 2, x => x + 10, x => x * x];
    const args = [[5], [15], [3]];

    const goAllResults = await goAll(functions, args, {
      useWorkerThreads: true,
    });
    console.log('goAll results:', goAllResults);

    // Test 8: Using lodash in worker threads
    console.log('\n8. Testing lodash usage in worker threads...');
    const result8 = await go(
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const _ = require('lodash');
        console.log('Lodash imported successfully in worker thread');

        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        return {
          sum: _.sum(numbers),
          average: _.mean(numbers),
          max: _.max(numbers),
          min: _.min(numbers),
          chunked: _.chunk(numbers, 3),
          unique: _.uniq([1, 2, 2, 3, 3, 4]),
          shuffled: _.shuffle(numbers).slice(0, 5),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Lodash usage result:', result8);

    // Test 9: Using moment in worker threads
    console.log('\n9. Testing moment usage in worker threads...');
    const result9 = await go(
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const moment = require('moment');
        console.log('Moment imported successfully in worker thread');

        const now = moment();
        return {
          currentDate: now.format('YYYY-MM-DD'),
          currentTime: now.format('HH:mm:ss'),
          timestamp: now.valueOf(),
          dayOfWeek: now.format('dddd'),
          isAfter: now.isAfter(moment().subtract(1, 'day')),
          relativeTime: now.fromNow(),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Moment usage result:', result9);

    // Test 10: Multiple external packages in one worker
    console.log(
      '\n10. Testing multiple external packages in worker threads...'
    );
    const result10 = await go(
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const _ = require('lodash');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const moment = require('moment');
        console.log('Multiple packages imported successfully in worker thread');

        const data = [
          { id: 1, name: 'Alice', age: 25, date: '2023-01-15' },
          { id: 2, name: 'Bob', age: 30, date: '2023-02-20' },
          { id: 3, name: 'Charlie', age: 28, date: '2023-03-10' },
          { id: 4, name: 'David', age: 35, date: '2023-04-05' },
        ];

        return {
          // Lodash operations
          averageAge: _.meanBy(data, 'age'),
          oldestPerson: _.maxBy(data, 'age'),
          names: _.map(data, 'name'),
          groupedByAge: _.groupBy(data, person =>
            person.age > 30 ? 'senior' : 'junior'
          ),

          // Moment operations
          currentTime: moment().format('YYYY-MM-DD HH:mm:ss'),
          parsedDates: data.map(item => ({
            name: item.name,
            date: moment(item.date).format('MMMM Do YYYY'),
            daysAgo: moment(item.date).fromNow(),
          })),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Multiple packages result:', result10);

    // Test 11: Dynamic imports based on arguments
    console.log('\n11. Testing dynamic imports in worker threads...');
    const result11 = await go(
      async packageName => {
        console.log(`Attempting to import: ${packageName}`);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require(packageName);

        if (packageName === 'lodash') {
          return {
            package: packageName,
            version: pkg.VERSION,
            functions: Object.keys(pkg).slice(0, 10), // First 10 functions
            sample: pkg.sum([1, 2, 3, 4, 5]),
          };
        } else if (packageName === 'moment') {
          return {
            package: packageName,
            version: pkg.version,
            functions: Object.keys(pkg).slice(0, 10), // First 10 functions
            sample: pkg().format(),
          };
        }

        return {
          package: packageName,
          available: !!pkg,
          type: typeof pkg,
        };
      },
      ['lodash'],
      { useWorkerThreads: true }
    );
    console.log('Dynamic import result:', result11);

    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

testWorkerThreads().catch(console.error);
