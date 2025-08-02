// @ts-check
import { go, once, sleep } from '../../../dist/index.js';

// Example 3: Once with different return values
let callCount = 0;
const counterOnce = once({ name: 'counterOnce' });
counterOnce.do(async () => {
  callCount++;
  console.log(`   Function called ${callCount} time(s)`);
  await sleep(50);
});

for (let i = 1; i <= 4; i++) {
  go(async () => {
    await counterOnce.do(async () => {
      callCount++;
      console.log(`   Function called ${callCount} time(s)`);
      await sleep(50);
    });
  });
}
