/* eslint-disable no-constant-condition */
// @ts-check
import {
  channel,
  go,
  sleep,
  select,
  INFINITE_TIMEOUT,
} from '../../../dist/index.js';

console.log('=== Select Example 4: Mixed Send/Receive Operations ===\n');

// Example 4: Select with mixed send and receive operations
const inputChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
const outputChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
const errorChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout

// Consumer goroutine
go(async () => {
  await sleep(100);

  while (true) {
    try {
      const data = await outputChannel.receive();
      console.log(`   Consumer: processed data - ${data}`);

      if (data === 'stop') {
        break;
      }
    } catch (error) {
      console.log('   Consumer: channel closed');
      break;
    }

    await sleep(200); // Simulate processing time
  }
});

// Error handler goroutine
go(async () => {
  while (true) {
    try {
      const error = await errorChannel.receive();
      console.log(`   Error Handler: ${error}`);
    } catch (err) {
      console.log('   Error Handler: channel closed');
      break;
    }
  }
});

// Test 1: Producer with mixed operations
go(async () => {
  console.log('   Test 1: Producer starting with mixed send/receive...');

  const messages = ['data1', 'data2', 'data3', 'error-prone-data', 'data4'];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    try {
      // Simulate error condition
      const result = await select([
        {
          channel: outputChannel,
          operation: 'send',
        },
        {
          channel: errorChannel,
          operation: 'send',
        },
        {
          channel: inputChannel,
          operation: 'receive',
        },
      ]);

      if (typeof result === 'string' && result.startsWith('Error')) {
        console.log(`   Test 1: Error case handled for ${message}`);
      } else if (result) {
        console.log(`   Test 1: Sent ${message || result}`);
      }
    } catch (error) {
      console.log(`   Test 1: Failed to process ${message}: ${error.message}`);
    }

    await sleep(150);
  }

  // Send stop signal
  await outputChannel.send('stop');
  console.log('   Test 1: Producer finished');
});

// Test 2: Bidirectional communication
go(async () => {
  await sleep(500); // Wait for first test to start

  console.log('   Test 2: Starting bidirectional communication...');

  const requestChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
  const responseChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout

  // Responder
  go(async () => {
    while (true) {
      try {
        const request = await requestChannel.receive();
        console.log(`   Responder: got request - ${request}`);

        if (request === 'quit') {
          await responseChannel.send('goodbye');
          break;
        }

        await responseChannel.send(`response to: ${request}`);
      } catch (error) {
        break;
      }
    }
  });

  // Requester using select for send/receive
  const requests = ['hello', 'how are you?', 'what time is it?', 'quit'];

  for (const request of requests) {
    // Send request and wait for response
    await select([
      {
        channel: requestChannel,
        operation: 'send',
        value: request,
      },
    ]);

    console.log(`   Test 2: Sent request: ${request}`);

    // Wait for response
    const response = await select(
      [
        {
          channel: responseChannel,
          operation: 'receive',
        },
      ],
      { timeout: 1000 }
    );

    console.log(`   Test 2: Got response: ${response}`);

    await sleep(200);
  }

  console.log('   Test 2: Bidirectional communication finished');
});

// Test 3: Load balancer pattern
go(async () => {
  await sleep(1200); // Wait for previous tests

  console.log('   Test 3: Load balancer pattern...');

  const worker1Channel = channel({ timeout: -1 }); // Infinite timeout
  const worker2Channel = channel({ timeout: -1 }); // Infinite timeout
  const resultChannel = channel({ timeout: -1 }); // Infinite timeout

  // Worker 1
  go(async () => {
    while (true) {
      try {
        const task = await worker1Channel.receive();
        console.log(`   Worker 1: processing ${task}`);
        await sleep(100); // Simulate work
        await resultChannel.send(`W1-${task}`);
      } catch (error) {
        break;
      }
    }
  });

  // Worker 2
  go(async () => {
    while (true) {
      try {
        const task = await worker2Channel.receive();
        console.log(`   Worker 2: processing ${task}`);
        await sleep(150); // Simulate different work speed
        await resultChannel.send(`W2-${task}`);
      } catch (error) {
        break;
      }
    }
  });

  // Load balancer
  const tasks = ['task1', 'task2', 'task3', 'task4', 'task5'];

  for (const task of tasks) {
    // Try to send to either worker (non-blocking)
    await select([
      {
        channel: worker1Channel,
        operation: 'send',
        value: task,
      },
      {
        channel: worker2Channel,
        operation: 'send',
        value: task,
      },
    ]);

    console.log(`   Test 3: Distributed task: ${task}`);
    await sleep(50);
  }

  // Collect results
  for (let i = 0; i < tasks.length; i++) {
    const result = await resultChannel.receive();
    console.log(`   Test 3: Result: ${result}`);
  }

  console.log('   Test 3: Load balancing completed');
});
