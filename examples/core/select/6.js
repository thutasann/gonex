// @ts-check
import {
  channel,
  go,
  sleep,
  select,
  INFINITE_TIMEOUT,
} from '../../../dist/index.js';

console.log('=== Select Example 6: Handlers and Event Processing ===\n');

// Example 6: Select with handlers for event-driven programming
const eventChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
const commandChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
const statusChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
const logChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout

// Event logger
let eventCount = 0;
let commandCount = 0;
let statusCount = 0;

// Test 1: Basic handlers
go(async () => {
  console.log('   Test 1: Setting up event handlers...');

  // Event generator
  go(async () => {
    const events = [
      'user-login',
      'user-logout',
      'data-update',
      'system-alert',
      'user-action',
    ];

    for (const event of events) {
      await eventChannel.send(event);
      await sleep(200);
    }
  });

  // Command generator
  go(async () => {
    const commands = [
      'backup',
      'restart',
      'update-config',
      'send-notification',
    ];

    for (const command of commands) {
      await sleep(150);
      await commandChannel.send(command);
    }
  });

  // Status generator
  go(async () => {
    const statuses = ['healthy', 'warning', 'error', 'recovering'];

    for (const status of statuses) {
      await sleep(300);
      await statusChannel.send(status);
    }
  });

  // Event processor with handlers
  while (eventCount + commandCount + statusCount < 13) {
    // Total expected events
    const result = await select(
      [
        {
          channel: eventChannel,
          operation: 'receive',
          handler: event => {
            eventCount++;
            console.log(
              `   Event Handler: Processed event '${event}' (${eventCount})`
            );

            // Trigger logging
            go(async () => {
              await logChannel.send(
                `EVENT: ${event} at ${new Date().toISOString()}`
              );
            });
          },
        },
        {
          channel: commandChannel,
          operation: 'receive',
          handler: command => {
            commandCount++;
            console.log(
              `   Command Handler: Executed command '${command}' (${commandCount})`
            );

            // Trigger logging
            go(async () => {
              await logChannel.send(
                `COMMAND: ${command} at ${new Date().toISOString()}`
              );
            });
          },
        },
        {
          channel: statusChannel,
          operation: 'receive',
          handler: status => {
            statusCount++;
            console.log(
              `   Status Handler: Status changed to '${status}' (${statusCount})`
            );

            // Trigger logging and alerts
            go(async () => {
              await logChannel.send(
                `STATUS: ${status} at ${new Date().toISOString()}`
              );

              if (status === 'error') {
                console.log('   🚨 ALERT: System error detected!');
              }
            });
          },
        },
      ],
      { timeout: 100 }
    );

    if (result === undefined) {
      console.log('   Main loop: No events in timeout window');
    }
  }

  console.log('   Test 1: Event processing completed');
});

// Test 2: State machine with handlers
go(async () => {
  await sleep(1000); // Wait for first test to start

  console.log('   Test 2: State machine with select handlers...');

  const stateChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
  const actionChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout

  let currentState = 'idle';
  const stateHistory = [];

  // State machine controller
  go(async () => {
    const transitions = [
      { from: 'idle', action: 'start', to: 'running' },
      { from: 'running', action: 'pause', to: 'paused' },
      { from: 'paused', action: 'resume', to: 'running' },
      { from: 'running', action: 'stop', to: 'stopped' },
      { from: 'stopped', action: 'reset', to: 'idle' },
    ];

    for (const transition of transitions) {
      await sleep(200);
      await actionChannel.send(transition.action);
    }
  });

  // State machine processor
  while (currentState !== 'idle' || stateHistory.length === 0) {
    await select(
      [
        {
          channel: actionChannel,
          operation: 'receive',
          handler: action => {
            const previousState = currentState;

            // Simple state transitions
            switch (currentState) {
              case 'idle':
                if (action === 'start') currentState = 'running';
                break;
              case 'running':
                if (action === 'pause') currentState = 'paused';
                if (action === 'stop') currentState = 'stopped';
                break;
              case 'paused':
                if (action === 'resume') currentState = 'running';
                if (action === 'stop') currentState = 'stopped';
                break;
              case 'stopped':
                if (action === 'reset') currentState = 'idle';
                break;
            }

            stateHistory.push({
              from: previousState,
              action,
              to: currentState,
            });
            console.log(
              `   State Machine: ${previousState} --[${action}]--> ${currentState}`
            );

            // Notify state change
            go(async () => {
              await stateChannel.send(currentState);
            });
          },
        },
      ],
      { timeout: 500 }
    );
  }

  console.log('   Test 2: State machine completed');
  console.log('   State history:', stateHistory);
});

// Test 3: Request-response with handlers
go(async () => {
  await sleep(2000); // Wait for previous tests

  console.log('   Test 3: Request-response pattern with handlers...');

  const requestChannel = channel({ timeout: -1 }); // Infinite timeout
  const responseChannel = channel({ timeout: -1 }); // Infinite timeout

  // Request processor
  go(async () => {
    const requests = [
      { id: 1, type: 'GET', resource: '/users' },
      { id: 2, type: 'POST', resource: '/users', data: { name: 'Alice' } },
      {
        id: 3,
        type: 'PUT',
        resource: '/users/1',
        data: { name: 'Alice Updated' },
      },
      { id: 4, type: 'DELETE', resource: '/users/1' },
    ];

    for (const request of requests) {
      await requestChannel.send(request);
      await sleep(300);
    }
  });

  // Server simulation
  let processedRequests = 0;

  while (processedRequests < 4) {
    await select([
      {
        channel: requestChannel,
        operation: 'receive',
        handler: async request => {
          processedRequests++;
          console.log(
            `   Server: Processing ${request.type} ${request.resource}`
          );

          // Simulate processing time
          await sleep(100);

          // Send response
          const response = {
            id: request.id,
            status: 200,
            message: `${request.type} request processed successfully`,
            timestamp: Date.now(),
          };

          await responseChannel.send(response);
          console.log(`   Server: Response sent for request ${request.id}`);
        },
      },
    ]);
  }

  // Response handler
  for (let i = 0; i < 4; i++) {
    await select([
      {
        channel: responseChannel,
        operation: 'receive',
        handler: response => {
          console.log(
            `   Client: Received response ${response.id}: ${response.message}`
          );
        },
      },
    ]);
  }

  console.log('   Test 3: Request-response completed');
});

// Log processor (runs throughout all tests)
go(async () => {
  console.log('   Log Processor: Starting...');

  let logCount = 0;
  let consecutiveTimeouts = 0;
  const maxConsecutiveTimeouts = 10; // Exit after 10 consecutive timeouts (2 seconds)

  while (logCount < 20 && consecutiveTimeouts < maxConsecutiveTimeouts) {
    // Process logs for a while
    const result = await select(
      [
        {
          channel: logChannel,
          operation: 'receive',
          handler: logEntry => {
            logCount++;
            consecutiveTimeouts = 0; // Reset timeout counter on successful receive
            console.log(`   📝 Log [${logCount}]: ${logEntry}`);
          },
        },
      ],
      { timeout: 200 }
    );

    if (result === undefined) {
      consecutiveTimeouts++;
    }
  }

  console.log('   Log Processor: Finished');
});
