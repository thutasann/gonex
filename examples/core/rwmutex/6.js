// @ts-check
import {
  go,
  rwMutex,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

async function testRWMutexWithWorkerThreads() {
  console.log('=== RWMutex Example 6: Worker Thread Integration ===\n');

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 4,
  });

  try {
    // Shared cache simulation - this will be coordinated across worker threads
    const cacheData = {
      users: new Map([
        ['user1', { name: 'Alice', score: 100 }],
        ['user2', { name: 'Bob', score: 85 }],
        ['user3', { name: 'Charlie', score: 92 }],
      ]),
      lastUpdated: Date.now(),
    };

    const rwmtx = rwMutex({ name: 'worker-cache-mutex', timeout: 5000 });

    // Test 1: Coordinated data access with worker thread computation
    console.log(
      '1. Testing coordinated data access with worker thread computation...'
    );

    const readerTasks = [];
    for (let i = 1; i <= 5; i++) {
      readerTasks.push(
        (async readerId => {
          // Use RWMutex in main thread for coordination
          await rwmtx.rLock();
          let userData;
          try {
            console.log(
              `   Reader ${readerId} acquired read lock in main thread`
            );
            // Read data in main thread (coordinated access)
            const userKey = `user${(readerId % 3) + 1}`;
            userData = cacheData.users.get(userKey);
            console.log(
              `   Reader ${readerId} read user: ${JSON.stringify(userData)}`
            );
          } finally {
            rwmtx.rUnlock();
            console.log(`   Reader ${readerId} released read lock`);
          }

          // Now do heavy computation in worker thread
          const computationResult = await go(
            async (data, iterations) => {
              console.log(
                `     Reader ${data.readerId} starting heavy computation in worker thread`
              );

              // Heavy computation showing true parallelism
              let result = 0;
              for (let j = 0; j < iterations; j++) {
                result +=
                  Math.sqrt(j) * Math.sin(j / 1000) + data.userData.score;
              }

              console.log(
                `     Reader ${data.readerId} completed computation: ${result.toFixed(2)}`
              );
              return result;
            },
            [{ readerId, userData }, 1000000],
            { useWorkerThreads: true }
          );

          return {
            readerId,
            userData,
            computationResult: computationResult.toFixed(2),
            timestamp: Date.now(),
          };
        })(i)
      );
    }

    const readerResults = await Promise.all(readerTasks);
    console.log(
      'All coordinated readers completed:',
      readerResults.length,
      'results\n'
    );

    // Test 2: Coordinated write with heavy computation in worker thread
    console.log(
      '2. Testing coordinated write with heavy computation in worker thread...'
    );

    // First, do heavy computation in worker thread
    const computedScores = await go(
      async usersData => {
        console.log('   Computing new scores in worker thread...');
        const newScores = {};

        // Heavy computation showing true parallelism
        for (const [userId, userData] of Object.entries(usersData)) {
          let heavyComputation = 0;
          for (let i = 0; i < 500000; i++) {
            heavyComputation += Math.pow(userData.score + i, 0.5);
          }
          newScores[userId] =
            Math.floor(heavyComputation % 1000) + userData.score;
        }

        console.log('   Heavy computation completed in worker thread');
        return newScores;
      },
      [Object.fromEntries(cacheData.users.entries())],
      { useWorkerThreads: true }
    );

    // Then, use RWMutex for coordinated write in main thread
    await rwmtx.lock();
    try {
      console.log('   Writer acquired exclusive lock in main thread');

      // Update cache with computed scores
      for (const [userId, newScore] of Object.entries(computedScores)) {
        const userData = cacheData.users.get(userId);
        // @ts-expect-error - TODO: fix this
        cacheData.users.set(userId, { ...userData, score: newScore });
      }
      cacheData.lastUpdated = Date.now();

      console.log('   Writer updated all user scores in main thread');
    } finally {
      rwmtx.unlock();
      console.log('   Writer released exclusive lock');
    }

    const writerResult = {
      operation: 'coordinated-write',
      updatedUsers: Object.keys(computedScores),
      newScores: computedScores,
      timestamp: cacheData.lastUpdated,
    };

    console.log('Writer result:', writerResult, '\n');

    // Test 3: Mixed read-write operations with external packages (coordinated)
    console.log('3. Testing coordinated operations with external packages...');

    // Coordinated read for analysis
    await rwmtx.rLock();
    let analysisData;
    try {
      console.log('   Analysis Reader acquired read lock');
      analysisData = Array.from(cacheData.users.values());
      console.log('   Analysis Reader read data for processing');
    } finally {
      rwmtx.rUnlock();
      console.log('   Analysis Reader released read lock');
    }

    // Heavy analysis in worker thread with external packages
    const analysisResult = await go(
      async userData => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const _ = require('lodash');
        console.log('   Running lodash analysis in worker thread...');

        return {
          averageScore: _.meanBy(userData, 'score'),
          topUser: _.maxBy(userData, 'score'),
          sortedUsers: _.sortBy(userData, 'score').reverse(),
          statistical: {
            sum: _.sum(userData.map(u => u.score)),
            min: _.min(userData.map(u => u.score)),
            max: _.max(userData.map(u => u.score)),
          },
        };
      },
      [analysisData],
      { useWorkerThreads: true }
    );

    console.log('   Lodash analysis completed:', analysisResult.averageScore);

    // Timestamp processing in worker thread
    const timeResult = await go(
      async timestamp => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const moment = require('moment');
        console.log('   Running moment processing in worker thread...');

        const lastUpdate = moment(timestamp);
        return {
          lastUpdated: lastUpdate.format('YYYY-MM-DD HH:mm:ss'),
          timeAgo: lastUpdate.fromNow(),
          isRecent: lastUpdate.isAfter(moment().subtract(1, 'minute')),
        };
      },
      [cacheData.lastUpdated],
      { useWorkerThreads: true }
    );

    console.log('   Moment processing completed:', timeResult.timeAgo);

    const mixedResults = [
      { type: 'lodash-analysis', analysis: analysisResult },
      { type: 'moment-processing', timeInfo: timeResult },
    ];

    console.log(
      'Mixed operations completed:',
      mixedResults.length,
      'operations\n'
    );

    // Test 4: Performance comparison with true parallelism
    console.log(
      '4. Testing performance with coordinated parallel processing...'
    );

    const heavyComputationTasks = [];

    // First, coordinate data access
    await rwmtx.rLock();
    let sharedUserData;
    try {
      console.log('   Performance test acquired read lock for data snapshot');
      sharedUserData = Array.from(cacheData.users.values());
    } finally {
      rwmtx.rUnlock();
      console.log('   Performance test released read lock');
    }

    // Now run heavy computations in parallel worker threads
    for (let i = 1; i <= 8; i++) {
      heavyComputationTasks.push(
        go(
          async (computerId, userData) => {
            const start = Date.now();
            console.log(
              `     Heavy Processor ${computerId} starting in worker thread`
            );

            // Very heavy computation showing true parallelism
            let result = 0;
            for (let j = 0; j < 2000000; j++) {
              result += Math.sqrt(j) * Math.cos(j / 1000) + userData[0].score;
            }

            const processedData = userData.map(user => ({
              ...user,
              computedValue: result / 1000000,
            }));

            const duration = Date.now() - start;
            console.log(
              `     Heavy Processor ${computerId} completed in ${duration}ms`
            );

            return {
              computerId,
              duration,
              dataSize: processedData.length,
              result,
            };
          },
          [i, sharedUserData],
          { useWorkerThreads: true }
        )
      );
    }

    const heavyResults = await Promise.all(heavyComputationTasks);
    const totalDuration = Math.max(...heavyResults.map(r => r.duration));
    console.log(
      `All heavy processors completed in ${totalDuration}ms (true parallel execution)\n`
    );

    // Test 5: Error handling in coordinated worker threads
    console.log('5. Testing error handling with coordinated worker threads...');

    try {
      // This shows proper coordination - read data first, then process
      await rwmtx.rLock();
      let testData;
      try {
        console.log('   Error test acquired read lock');
        testData = cacheData.users.get('user1');
      } finally {
        rwmtx.rUnlock();
        console.log('   Error test released read lock properly');
      }

      // Now try processing in worker thread with error
      await go(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async data => {
          console.log('   Starting error simulation in worker thread...');
          // Simulate error during processing
          throw new Error('Simulated error in worker thread processing');
        },
        [testData],
        { useWorkerThreads: true }
      );
    } catch (error) {
      console.log('   Caught expected error:', error.message);
      console.log('   Main thread coordination remained intact');
    }

    // Test 6: Final state verification
    console.log('\n6. Final coordinated cache state:');
    await rwmtx.rLock();
    try {
      console.log('   Final verification acquired read lock');
      for (const [userId, userData] of cacheData.users.entries()) {
        console.log(`   ${userId}: ${JSON.stringify(userData)}`);
      }
      console.log(
        `   Last updated: ${new Date(cacheData.lastUpdated).toISOString()}`
      );
    } finally {
      rwmtx.rUnlock();
      console.log('   Final verification released read lock');
    }

    console.log(
      '\n✅ All RWMutex + Worker Thread coordination tests completed successfully!'
    );
    console.log('\nKey Benefits Demonstrated:');
    console.log('- RWMutex coordinates data access in main thread');
    console.log(
      '- Worker threads provide true CPU parallelism for heavy computation'
    );
    console.log('- Clean separation between coordination and computation');
    console.log('- External packages work seamlessly in worker threads');
    console.log('- Error handling preserves main thread coordination');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
    console.log('\nParallel scheduler shutdown complete.');
  }
}

testRWMutexWithWorkerThreads().catch(console.error);
