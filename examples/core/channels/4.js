// @ts-check
import { go, channel, sleep } from '../../../dist/index.js';

// Example 4: Channel close
const closeCh = channel();

go(async () => {
  await sleep(200);
  await closeCh.send('Final message');
  closeCh.close();
  console.log('   Channel closed');
});

go(async () => {
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const msg = await closeCh.receive();
      console.log(`   Received: ${msg}`);
    }
  } catch (error) {
    console.log(`   Channel closed: ${error.message}`);
  }
});
