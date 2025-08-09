// @ts-check
import { go, newCond, Mutex, sleep } from '../../../dist/index.js';

// Example 1: Basic condition variable usage
console.log('🔔 Example 1: Basic producer-consumer with condition variable');

let ready = false;
const mutex = new Mutex();
const cond = newCond(mutex);

// Producer
go(async () => {
  console.log('   📤 Producer: Starting work...');
  await sleep(500); // Simulate work

  await mutex.lock();
  ready = true;
  console.log('   📤 Producer: Work completed, broadcasting to all consumers');
  cond.broadcast(); // Wake up all waiting consumers
  mutex.unlock();
});

// Consumer 1
go(async () => {
  console.log('   📥 Consumer 1: Waiting for work to be ready...');

  await mutex.lock();
  while (!ready) {
    console.log('   📥 Consumer 1: Condition not met, waiting...');
    await cond.wait();
  }
  console.log('   📥 Consumer 1: Work is ready! Processing...');
  mutex.unlock();
});

// Consumer 2
go(async () => {
  await sleep(100); // Start slightly later
  console.log('   📥 Consumer 2: Waiting for work to be ready...');

  await mutex.lock();
  while (!ready) {
    console.log('   📥 Consumer 2: Condition not met, waiting...');
    await cond.wait();
  }
  console.log('   📥 Consumer 2: Work is ready! Processing...');
  mutex.unlock();
});
