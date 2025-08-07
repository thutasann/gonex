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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const moment = require('moment');
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const moment = require('moment');
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

    console.log('\nAll moment import tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

testMomentImports().catch(console.error);
