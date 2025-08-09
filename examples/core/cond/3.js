// @ts-check
import { go, cond, sleep } from '../../../dist/index.js';

// Example 3: Using convenience cond() function and timeout
console.log('🔔 Example 3: Condition variable with timeout');

const condVar = cond({ timeout: 1000, name: 'timeout-example' });
const mutex = condVar.getLocker();

// Producer that takes too long
go(async () => {
  console.log('   📤 Slow Producer: Starting very slow work...');
  await sleep(2000); // Takes longer than timeout

  await mutex.lock();
  console.log('   📤 Slow Producer: Work completed (but too late)');
  condVar.signal();
  mutex.unlock();
});

// Consumer with timeout
go(async () => {
  console.log('   📥 Consumer: Waiting with 1 second timeout...');

  await mutex.lock();
  try {
    await condVar.wait();
    console.log('   📥 Consumer: Received signal!');
  } catch (error) {
    console.log(`   📥 Consumer: Timeout occurred - ${error.message}`);
  }
  mutex.unlock();
});

// Another consumer with custom timeout
go(async () => {
  await sleep(100);
  console.log('   📥 Consumer 2: Waiting with 3 second timeout...');

  await mutex.lock();
  try {
    await condVar.wait(3000); // Custom timeout longer than producer delay
    console.log('   📥 Consumer 2: Eventually received signal!');
  } catch (error) {
    console.log(`   📥 Consumer 2: Timeout occurred - ${error.message}`);
  }
  mutex.unlock();
});
