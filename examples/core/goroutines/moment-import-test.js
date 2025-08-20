/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
import {
  go,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

async function testMomentImports() {
  console.log(
    'Testing moment package import functionality in worker threads...'
  );

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Test 1: Basic moment import
    console.log('\n1. Testing basic moment import...');
    const result1 = await go(
      async () => {
        const moment = (await import('moment')).default;

        const { sleep } = await import('gonex');
        await sleep(300);
        console.log('Moment imported successfully in worker thread');
        return {
          version: moment.version,
          now: moment().format(),
          isValid: moment().isValid(),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Moment basic result:', result1);

    // Test 2: Moment with date formatting
    console.log('\n2. Testing moment with date formatting...');
    const result2 = await go(
      async () => {
        const moment = require('moment');
        const sleep = (await import('./helpers/sleep.cjs')).default;

        await sleep(300);
        console.log('Moment imported for date formatting');

        const now = moment();
        return {
          currentDate: now.format('YYYY-MM-DD'),
          currentTime: now.format('HH:mm:ss'),
          timestamp: now.valueOf(),
          isAfter: now.isAfter(moment().subtract(1, 'day')),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Moment formatting result:', result2);

    // Test 3: Lodash Import Testing
    console.log('\n3. Testing lodash import...');
    const result3 = await go(
      async () => {
        const lodash = (await import('lodash')).default;
        const sleep = (await import('./helpers/sleep.js')).default;

        await sleep(300);
        console.log('Lodash imported successfully');
        return {
          isArray: lodash.isArray([1, 2, 3]),
          capitalize: lodash.capitalize('hello'),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Lodash result:', result3);

    // Test 4: chalk import testing
    console.log('\n4. Testing chalk import...');
    const result4 = await go(
      async () => {
        const chalk = (await import('chalk')).default;
        console.log('Chalk imported successfully');
        console.log(chalk.red('Hello, world!'));
        console.log(chalk.green('Hello, world!'));
        console.log(chalk.blue('Hello, world!'));

        return {
          red: chalk.red('Hello, world!'),
          green: chalk.green('Hello, world!'),
          blue: chalk.blue('Hello, world!'),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Chalk result:', result4);

    console.log('\nAll moment import tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

testMomentImports().catch(console.error);
