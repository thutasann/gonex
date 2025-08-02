// @ts-check
import { go, channel } from '../../../dist/index.js';

// Example 3: Channel with timeout
const timeoutCh = channel();

go(async () => {
  try {
    const result = await timeoutCh.receive(500); // 500ms timeout
    console.log(`   Received: ${result}`);
  } catch (error) {
    console.log(`   Timeout error: ${error.message}`);
  }
});
