/* eslint-disable no-constant-condition */
// @ts-check
import {
  channel,
  go,
  sleep,
  select,
  INFINITE_TIMEOUT,
} from '../../../dist/index.js';

console.log('=== Select Example 5: Buffered Channels ===\n');

// Example 5: Select with buffered channels
const unbufferedChannel = channel({ timeout: INFINITE_TIMEOUT }); // Infinite timeout
const smallBufferChannel = channel({
  bufferSize: 2,
  timeout: INFINITE_TIMEOUT,
}); // Infinite timeout
const largeBufferChannel = channel({
  bufferSize: 10,
  timeout: INFINITE_TIMEOUT,
}); // Infinite timeout

// Test 1: Buffer behavior comparison
go(async () => {
  console.log('   Test 1: Comparing buffered vs unbuffered channels...');

  // Fill up the small buffer
  console.log('   Test 1: Filling small buffer channel...');
  await smallBufferChannel.send('item1');
  await smallBufferChannel.send('item2');
  console.log('   Test 1: Small buffer filled (2/2)');

  // Try to send to different channels
  const start = Date.now();

  const result = await select(
    [
      {
        channel: unbufferedChannel,
        operation: 'send',
        value: 'unbuffered-msg',
      },
      {
        channel: smallBufferChannel,
        operation: 'send',
        value: 'would-block',
      },
      {
        channel: largeBufferChannel,
        operation: 'send',
        value: 'large-buffer-msg',
      },
    ],
    { timeout: 100 }
  );

  const duration = Date.now() - start;
  console.log(`   Test 1: Selected channel in ${duration}ms, sent: ${result}`);
});

// Consumer for small buffer
go(async () => {
  await sleep(200); // Let buffer fill up first

  console.log('   Consumer: Starting to drain small buffer...');
  while (true) {
    try {
      const item = await smallBufferChannel.receive();
      console.log(`   Consumer: received from small buffer - ${item}`);
      await sleep(300); // Slow consumer
    } catch (error) {
      break;
    }
  }
});

// Test 2: Buffer availability detection
go(async () => {
  await sleep(150);

  console.log('   Test 2: Testing buffer availability...');

  const messages = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];

  for (const message of messages) {
    const channelStatus = await select(
      [
        {
          channel: smallBufferChannel,
          operation: 'send',
          value: `small-${message}`,
        },
        {
          channel: largeBufferChannel,
          operation: 'send',
          value: `large-${message}`,
        },
      ],
      {
        default: () => {
          console.log(`   Test 2: All channels busy for ${message}`);
        },
      }
    );

    if (channelStatus !== undefined) {
      console.log(`   Test 2: Successfully sent: ${channelStatus}`);
    }

    await sleep(100);
  }
});

// Test 3: Burst handling with buffers
go(async () => {
  await sleep(800);

  console.log('   Test 3: Handling message bursts...');

  const burstChannel = channel({
    bufferSize: 5,
    timeout: INFINITE_TIMEOUT,
  }); // Infinite timeout

  // Burst sender
  go(async () => {
    console.log('   Burst Sender: Sending burst of messages...');

    const burst = [
      'burst1',
      'burst2',
      'burst3',
      'burst4',
      'burst5',
      'burst6',
      'burst7',
    ];
    let sentCount = 0;

    for (const msg of burst) {
      const result = await select(
        [
          {
            channel: burstChannel,
            operation: 'send',
            value: msg,
          },
        ],
        {
          timeout: 50,
          default: () => {
            console.log(`   Burst Sender: Buffer full, dropping ${msg}`);
          },
        }
      );

      if (result !== undefined) {
        sentCount++;
        console.log(
          `   Burst Sender: Sent ${msg} (${sentCount}/${burst.length})`
        );
      }
    }

    console.log(
      `   Burst Sender: Completed, sent ${sentCount}/${burst.length} messages`
    );
  });

  // Slow consumer
  go(async () => {
    await sleep(200); // Let burst build up

    console.log('   Burst Consumer: Starting to process burst...');

    let processedCount = 0;
    while (true) {
      try {
        const result = await select(
          [
            {
              channel: burstChannel,
              operation: 'receive',
            },
          ],
          { timeout: 500 }
        );

        if (result !== undefined) {
          processedCount++;
          console.log(
            `   Burst Consumer: Processed ${result} (${processedCount})`
          );
          await sleep(100); // Simulate processing time
        }
      } catch (error) {
        console.log(
          `   Burst Consumer: Finished, processed ${processedCount} messages`
        );
        break;
      }
    }
  });
});

// Test 4: Buffer size optimization
go(async () => {
  await sleep(1500);

  console.log('   Test 4: Buffer size optimization...');

  const channels = [
    { name: 'tiny', ch: channel({ bufferSize: 1, timeout: INFINITE_TIMEOUT }) },
    {
      name: 'small',
      ch: channel({ bufferSize: 3, timeout: INFINITE_TIMEOUT }),
    },
    {
      name: 'medium',
      ch: channel({ bufferSize: 7, timeout: INFINITE_TIMEOUT }),
    },
    {
      name: 'large',
      ch: channel({ bufferSize: 15, timeout: INFINITE_TIMEOUT }),
    },
  ];

  // Producer trying different buffer sizes
  go(async () => {
    const testData = Array.from({ length: 20 }, (_, i) => `data-${i + 1}`);

    for (const data of testData) {
      const result = await select(
        channels.map(({ ch }) => ({
          channel: ch,
          operation: 'send',
          value: data,
        })),
        {
          default: () => {
            console.log(`   Producer: All buffers full for ${data}`);
          },
        }
      );

      if (result !== undefined) {
        const channelType = result.split('-')[0];
        console.log(`   Producer: Sent to ${channelType} buffer: ${data}`);
      }

      await sleep(25);
    }

    console.log('   Producer: Finished sending test data');
  });

  // Consumers with different speeds
  channels.forEach(({ name, ch }, index) => {
    go(async () => {
      const delay = (index + 1) * 50; // Different processing speeds

      while (true) {
        try {
          const result = await select(
            [
              {
                channel: ch,
                operation: 'receive',
              },
            ],
            { timeout: 1000 }
          );

          if (result !== undefined) {
            console.log(`   ${name} Consumer: processed ${result}`);
          }

          await sleep(delay);
        } catch (error) {
          console.log(`   ${name} Consumer: timed out, stopping`);
          break;
        }
      }
    });
  });
});
