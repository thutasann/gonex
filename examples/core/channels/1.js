// @ts-check
import { go, channel, sleep } from '../../../dist/index.js';

// Example 1: Basic channel communication
const ch1 = channel();

go(async () => {
  await sleep(100);
  await ch1.send('Hello from sender!');
  console.log('   Message sent');
});

go(async () => {
  const msg = await ch1.receive();
  console.log(`   Received: ${msg}`);
});
