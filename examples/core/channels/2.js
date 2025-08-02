// @ts-check
import { go, channel, sleep } from '../../../dist/index.js';

// Example 2: Buffered channel
const bufferedCh = channel({ bufferSize: 3 }); // Buffer size of 3

go(async () => {
  for (let i = 1; i <= 3; i++) {
    await bufferedCh.send(`Message ${i}`);
    console.log(`   Sent message ${i}`);
  }
});

go(async () => {
  for (let i = 1; i <= 3; i++) {
    const msg = await bufferedCh.receive();
    console.log(`   Received: ${msg}`);
    await sleep(50);
  }
});
