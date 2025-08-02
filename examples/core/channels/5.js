// @ts-check
import { go, channel, sleep } from '../../../dist/index.js';

// Example 5: Multiple senders and receivers
const multiCh = channel({ bufferSize: 5 });

// Multiple senders
for (let i = 1; i <= 3; i++) {
  go(async () => {
    for (let j = 1; j <= 2; j++) {
      await multiCh.send(`Sender ${i}, Message ${j}`);
      await sleep(50);
    }
  });
}

// Multiple receivers
for (let i = 1; i <= 2; i++) {
  go(async () => {
    for (let j = 1; j <= 3; j++) {
      const msg = await multiCh.receive();
      console.log(`   Receiver ${i} got ===>: ${msg}`);
    }
  });
}
