// @ts-check
import { go, channel, sleep } from 'gonex';

console.log('=== Channels Example ===\n');

// Example 1: Basic channel communication
console.log('1. Basic channel communication:');
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

// // Example 2: Buffered channel
// console.log('\n2. Buffered channel:');
// const bufferedCh = channel({ bufferSize: 3 }); // Buffer size of 3

// go(async () => {
//   for (let i = 1; i <= 3; i++) {
//     await bufferedCh.send(`Message ${i}`);
//     console.log(`   Sent message ${i}`);
//   }
// });

// go(async () => {
//   for (let i = 1; i <= 3; i++) {
//     const msg = await bufferedCh.receive();
//     console.log(`   Received: ${msg}`);
//     await sleep(50);
//   }
// });

// // Example 3: Channel with timeout
// console.log('\n3. Channel with timeout:');
// const timeoutCh = channel();

// go(async () => {
//   try {
//     const result = await timeoutCh.receive(500); // 500ms timeout
//     console.log(`   Received: ${result}`);
//   } catch (error) {
//     console.log(`   Timeout error: ${error.message}`);
//   }
// });

// // Example 4: Channel close
// console.log('\n4. Channel close:');
// const closeCh = channel();

// go(async () => {
//   await sleep(200);
//   await closeCh.send('Final message');
//   closeCh.close();
//   console.log('   Channel closed');
// });

// go(async () => {
//   try {
//     // eslint-disable-next-line no-constant-condition
//     while (true) {
//       const msg = await closeCh.receive();
//       console.log(`   Received: ${msg}`);
//     }
//   } catch (error) {
//     console.log(`   Channel closed: ${error.message}`);
//   }
// });

// // Example 5: Multiple senders and receivers
// console.log('\n5. Multiple senders and receivers:');
// const multiCh = channel({ bufferSize: 5 });

// // Multiple senders
// for (let i = 1; i <= 3; i++) {
//   go(async () => {
//     for (let j = 1; j <= 2; j++) {
//       await multiCh.send(`Sender ${i}, Message ${j}`);
//       await sleep(50);
//     }
//   });
// }

// // Multiple receivers
// for (let i = 1; i <= 2; i++) {
//   go(async () => {
//     for (let j = 1; j <= 3; j++) {
//       const msg = await multiCh.receive();
//       console.log(`   Receiver ${i} got: ${msg}`);
//     }
//   });
// }

// console.log('\nAll channel examples started. Waiting for completion...\n');
