/* eslint-disable no-constant-condition */
// @ts-check
import {
  channel,
  go,
  sleep,
  select,
  waitGroup,
  INFINITE_TIMEOUT,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

async function runAdvancedSelectExample() {
  console.log(
    '=== Select Example 7: Multiple Goroutines and Advanced Patterns ===\n'
  );

  // Initialize parallel scheduler with worker threads
  // Note: Select operations require shared access to channels, so coordination
  // goroutines will run in the main thread while individual processing tasks
  // can optionally use worker threads for CPU-intensive work
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 4, // Use 4 worker threads for processing tasks
    timeout: 1000000,
  });

  try {
    // Example 7: Complex patterns with multiple goroutines
    const workChannel = channel({ bufferSize: 5, timeout: INFINITE_TIMEOUT }); // Infinite timeout
    const resultChannel = channel({
      bufferSize: 10,
      timeout: INFINITE_TIMEOUT,
    }); // Infinite timeout
    const controlChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
    const monitorChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout

    // Test 1: Worker pool with select-based coordination
    go(
      async () => {
        console.log('   Test 1: Worker pool with select coordination...');

        const wg = waitGroup();
        const numWorkers = 3;
        const numTasks = 10;

        // Start workers
        for (let workerId = 1; workerId <= numWorkers; workerId++) {
          wg.add(1);

          go(
            async () => {
              console.log(`   Worker ${workerId}: Starting`);

              while (true) {
                const result = await select(
                  [
                    {
                      channel: workChannel,
                      operation: 'receive',
                    },
                    {
                      channel: controlChannel,
                      operation: 'receive',
                    },
                  ],
                  { timeout: 1000 }
                );

                if (result === 'shutdown') {
                  console.log(`   Worker ${workerId}: Shutting down`);
                  break;
                } else if (result === undefined) {
                  console.log(
                    `   Worker ${workerId}: No work available, checking again...`
                  );
                  continue;
                } else if (
                  typeof result === 'object' &&
                  result.type === 'task'
                ) {
                  console.log(
                    `   Worker ${workerId}: Processing task ${result.id}`
                  );

                  // Simulate work
                  await sleep(Math.random() * 300 + 100);

                  // Send result
                  await resultChannel.send({
                    taskId: result.id,
                    workerId,
                    result: `processed-${result.id}`,
                    timestamp: Date.now(),
                  });

                  console.log(
                    `   Worker ${workerId}: Completed task ${result.id}`
                  );
                }
              }

              wg.done();
            },
            [],
            { useWorkerThreads: true }
          );
        }

        // Task producer
        go(
          async () => {
            console.log('   Producer: Starting task generation...');

            for (let i = 1; i <= numTasks; i++) {
              const task = {
                type: 'task',
                id: i,
                data: `task-data-${i}`,
                priority: Math.floor(Math.random() * 3) + 1,
              };

              await workChannel.send(task);
              console.log(`   Producer: Queued task ${i}`);

              await sleep(100);
            }

            console.log('   Producer: All tasks queued');
          },
          [],
          { useWorkerThreads: true }
        );

        // Result collector
        go(
          async () => {
            const results = [];

            while (results.length < numTasks) {
              const result = await resultChannel.receive();
              results.push(result);
              console.log(
                `   Collector: Got result for task ${result.taskId} from worker ${result.workerId}`
              );
            }

            console.log('   Collector: All results collected');
            console.log(
              `   Results summary: ${results.length} tasks completed`
            );

            // Signal workers to shutdown
            for (let i = 0; i < numWorkers; i++) {
              await controlChannel.send('shutdown');
            }
          },
          [],
          { useWorkerThreads: true }
        );

        // Wait for all workers to complete
        await wg.wait();
        console.log('   Test 1: Worker pool completed');
      },
      [],
      { useWorkerThreads: true }
    );

    // Test 2: Fan-out/Fan-in pattern
    go(
      async () => {
        await sleep(3000); // Wait for first test

        console.log('   Test 2: Fan-out/Fan-in pattern...');

        const inputChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
        const fanoutChannels = [
          channel({ name: 'processor-1', timeout: INFINITE_TIMEOUT }),
          channel({ name: 'processor-2', timeout: INFINITE_TIMEOUT }),
          channel({ name: 'processor-3', timeout: -1 }),
        ];
        const fanInChannel = channel({ bufferSize: 10, timeout: -1 }); // Infinite timeout

        // Data generator
        go(
          async () => {
            const data = Array.from({ length: 15 }, (_, i) => ({
              id: i + 1,
              value: Math.random() * 100,
              timestamp: Date.now(),
            }));

            for (const item of data) {
              await inputChannel.send(item);
              await sleep(50);
            }

            // Signal end
            await inputChannel.send(null);
            console.log('   Generator: Finished sending data');
          },
          [],
          { useWorkerThreads: true }
        );

        // Fan-out dispatcher
        go(
          async () => {
            let channelIndex = 0;

            while (true) {
              const data = await inputChannel.receive();

              if (data === null) {
                // Signal all processors to stop
                for (const ch of fanoutChannels) {
                  await ch.send(null);
                }
                break;
              }

              // Round-robin distribution
              await fanoutChannels[channelIndex].send(data);
              console.log(
                `   Dispatcher: Sent item ${data.id} to processor ${channelIndex + 1}`
              );

              channelIndex = (channelIndex + 1) % fanoutChannels.length;
            }

            console.log('   Dispatcher: Finished distribution');
          },
          [],
          { useWorkerThreads: true }
        );

        // Processors (fan-out)
        fanoutChannels.forEach((ch, index) => {
          go(
            async () => {
              const processorId = index + 1;
              console.log(`   Processor ${processorId}: Starting`);

              while (true) {
                const data = await ch.receive();

                if (data === null) {
                  console.log(`   Processor ${processorId}: Stopping`);
                  break;
                }

                // Process data
                await sleep(Math.random() * 200 + 100);

                const processedData = {
                  ...data,
                  processed: true,
                  processorId,
                  processedAt: Date.now(),
                };

                await fanInChannel.send(processedData);
                console.log(
                  `   Processor ${processorId}: Processed item ${data.id}`
                );
              }
            },
            [],
            { useWorkerThreads: true }
          );
        });

        // Fan-in collector
        go(
          async () => {
            const collected = [];
            let nullCount = 0;

            while (nullCount < fanoutChannels.length) {
              const result = await select(
                [
                  {
                    channel: fanInChannel,
                    operation: 'receive',
                  },
                ],
                { timeout: 500 }
              );

              if (result === undefined) {
                nullCount++;
                console.log('   Collector: Timeout, checking if done...');
              } else {
                collected.push(result);
                console.log(
                  `   Collector: Collected item ${result.id} from processor ${result.processorId}`
                );
              }
            }

            console.log(
              `   Test 2: Fan-out/Fan-in completed, collected ${collected.length} items`
            );
          },
          [],
          { useWorkerThreads: true }
        );
      },
      [],
      { useWorkerThreads: true }
    );

    // Test 3: Pipeline with backpressure
    go(
      async () => {
        await sleep(6000); // Wait for previous tests

        console.log('   Test 3: Pipeline with backpressure control...');

        const stage1Channel = channel({ bufferSize: 2, timeout: -1 }); // Infinite timeout
        const stage2Channel = channel({ bufferSize: 2, timeout: -1 }); // Infinite timeout
        const stage3Channel = channel({ bufferSize: 2, timeout: -1 }); // Infinite timeout
        const finalChannel = channel({ bufferSize: 5, timeout: -1 }); // Infinite timeout

        // Data source with backpressure awareness
        go(
          async () => {
            const items = Array.from({ length: 8 }, (_, i) => `item-${i + 1}`);

            for (const item of items) {
              // Use select to handle backpressure
              const sent = await select(
                [
                  {
                    channel: stage1Channel,
                    operation: 'send',
                    value: item,
                  },
                ],
                {
                  timeout: 100,
                  default: () => {
                    console.log(
                      `   Source: Backpressure detected for ${item}, retrying...`
                    );
                  },
                }
              );

              if (sent === undefined) {
                // Retry with longer timeout
                await stage1Channel.send(item);
                console.log(`   Source: Sent ${item} after backpressure`);
              } else {
                console.log(`   Source: Sent ${item} immediately`);
              }

              await sleep(50);
            }

            await stage1Channel.send(null); // End signal
          },
          [],
          { useWorkerThreads: true }
        );

        // Pipeline stages
        const stages = [
          {
            input: stage1Channel,
            output: stage2Channel,
            name: 'Stage 1',
            delay: 100,
          },
          {
            input: stage2Channel,
            output: stage3Channel,
            name: 'Stage 2',
            delay: 150,
          },
          {
            input: stage3Channel,
            output: finalChannel,
            name: 'Stage 3',
            delay: 200,
          },
        ];

        stages.forEach(({ input, output, name, delay }) => {
          go(
            async () => {
              console.log(`   ${name}: Starting`);

              while (true) {
                const item = await input.receive();

                if (item === null) {
                  await output.send(null);
                  console.log(`   ${name}: Finished`);
                  break;
                }

                // Process with artificial delay
                await sleep(delay);

                const processed = `${name.toLowerCase().replace(' ', '')}-${item}`;
                await output.send(processed);

                console.log(`   ${name}: Processed ${item} -> ${processed}`);
              }
            },
            [],
            { useWorkerThreads: true }
          );
        });

        // Final consumer
        go(
          async () => {
            const results = [];

            while (true) {
              const item = await finalChannel.receive();

              if (item === null) {
                break;
              }

              results.push(item);
              console.log(`   Consumer: Final result - ${item}`);
            }

            console.log(
              `   Test 3: Pipeline completed, processed ${results.length} items`
            );
          },
          [],
          { useWorkerThreads: true }
        );
      },
      [],
      { useWorkerThreads: true }
    );

    // Monitor goroutine (runs throughout all tests)
    go(
      async monitorChannel => {
        console.log('   Monitor: Starting system monitoring...');

        let monitorCount = 0;

        while (monitorCount < 50) {
          // Monitor for a while
          const result = await select(
            [
              {
                channel: monitorChannel,
                operation: 'receive',
              },
            ],
            {
              timeout: 200,
              default: () => {
                monitorCount++;
                console.log(
                  `   Monitor: System check ${monitorCount} - All systems operational`
                );
              },
            }
          );

          if (result !== undefined) {
            console.log(`   Monitor: Received signal - ${result}`);
          }
        }

        console.log('   Monitor: Monitoring completed');
      },
      [monitorChannel],
      { useWorkerThreads: true }
    );

    // Wait for all tests to complete
    await sleep(15000); // Give tests time to finish
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Error running example:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

runAdvancedSelectExample().catch(console.error);
