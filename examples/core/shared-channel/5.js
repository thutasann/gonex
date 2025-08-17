// // @ts-check
// import { SharedChannel } from '../../../dist/index.js';
// import { Worker } from 'worker_threads';
// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// console.log('=== Shared Channels Example 5: Worker Thread Integration ===\n');

// // Example 5: Integration with worker threads using shared channels
// async function workerThreadIntegration() {
//   console.log('1. Creating SharedChannel for worker communication:');

//   const channel = new SharedChannel({
//     bufferSize: 2 * 1024 * 1024, // 2MB
//     maxMessages: 1000,
//     enableBatching: true,
//     compressionThreshold: 512,
//     enableChecksum: true,
//     timeout: 60000, // 1 minute
//   });

//   console.log('   Channel created for worker thread communication');

//   // Create worker thread
//   console.log('\n2. Creating worker thread:');

//   const worker = new Worker(join(__dirname, 'channel-worker.js'), {
//     workerData: {
//       channelId: 'main-channel',
//       workerId: 'worker-1',
//     },
//   });

//   console.log('   Worker thread created');

//   // Set up worker message handling
//   worker.on('message', message => {
//     console.log(`   Worker message: ${message}`);
//   });

//   worker.on('error', error => {
//     console.error(`   Worker error: ${error.message}`);
//   });

//   worker.on('exit', code => {
//     console.log(`   Worker exited with code ${code}`);
//   });

//   // Send data to worker via channel
//   console.log('\n3. Sending data to worker via channel:');

//   const messages = [
//     'Hello from main thread!',
//     'This is a test message',
//     'Testing shared channel communication',
//     'Message with special characters: !@#$%^&*()',
//     'Final message for this test',
//   ];

//   for (let i = 0; i < messages.length; i++) {
//     await channel.send(messages[i]);
//     console.log(`   Sent message ${i + 1}: "${messages[i]}"`);
//   }

//   // Wait for worker to process
//   console.log('\n4. Waiting for worker to process data...');

//   await new Promise(resolve => {
//     const checkInterval = setInterval(() => {
//       if (channel.getLength() === 0) {
//         clearInterval(checkInterval);
//         // @ts-expect-error - TODO: ignore
//         resolve();
//       }
//     }, 100);

//     // Timeout after 30 seconds
//     setTimeout(() => {
//       clearInterval(checkInterval);
//       console.log('   Timeout waiting for worker processing');
//       // @ts-expect-error - TODO: ignore
//       resolve();
//     }, 30000);
//   });

//   console.log('   Worker processing completed');

//   // Check channel state
//   console.log('\n5. Channel state after worker processing:');
//   const state = channel.getState();
//   console.log(`   Messages in channel: ${state.length}`);
//   console.log(`   Channel capacity: ${state.capacity}`);
//   console.log(`   Is empty: ${state.isEmpty}`);

//   // Test multiple workers
//   console.log('\n6. Testing multiple workers:');

//   const workers = [];
//   const workerCount = 3;

//   for (let i = 0; i < workerCount; i++) {
//     const worker = new Worker(join(__dirname, 'channel-worker.js'), {
//       workerData: {
//         channelId: `worker-${i}-channel`,
//         workerId: `worker-${i}`,
//       },
//     });

//     workers.push(worker);
//     console.log(`   Created worker ${i}`);

//     // Send data to each worker
//     const workerMessages = [`Data for worker ${i}`, `Task ${i}`, `Job ${i}`];
//     for (const message of workerMessages) {
//       await channel.send(message);
//     }
//   }

//   // Wait for all workers to complete
//   console.log('\n7. Waiting for all workers to complete...');

//   await Promise.all(
//     workers.map(worker => {
//       return new Promise(resolve => {
//         const timeout = setTimeout(() => {
//           console.log(`   Worker timeout, forcing termination`);
//           worker.terminate();
//           // @ts-expect-error - TODO: ignore
//           resolve();
//         }, 10000); // 10 second timeout

//         worker.on('exit', code => {
//           clearTimeout(timeout);
//           console.log(`   Worker exited with code ${code}`);
//           // @ts-expect-error - TODO: ignore
//           resolve();
//         });

//         worker.on('error', error => {
//           clearTimeout(timeout);
//           console.log(`   Worker error: ${error.message}`);
//           // @ts-expect-error - TODO: ignore
//           resolve();
//         });
//       });
//     })
//   );

//   console.log('   All workers completed');

//   // Final channel state
//   console.log('\n8. Final channel state:');
//   const finalState = channel.getState();
//   console.log(`   Messages in channel: ${finalState.length}`);
//   console.log(`   Channel capacity: ${finalState.capacity}`);

//   // Performance metrics
//   console.log('\n9. Performance metrics:');
//   const memoryUsage = channel.getMemoryUsage();
//   console.log(
//     `   Memory usage: ${memoryUsage.usedSize}/${memoryUsage.totalSize} bytes`
//   );
//   console.log(
//     `   Memory efficiency: ${((memoryUsage.usedSize / memoryUsage.totalSize) * 100).toFixed(1)}%`
//   );

//   // Cleanup
//   console.log('\n10. Cleanup:');

//   // Force terminate any remaining workers
//   workers.forEach(worker => {
//     try {
//       worker.terminate();
//     } catch (error) {
//       console.log(`   Worker termination error: ${error.message}`);
//     }
//   });

//   // Also terminate the main worker
//   try {
//     worker.terminate();
//   } catch (error) {
//     console.log(`   Main worker termination error: ${error.message}`);
//   }

//   // Clear channel
//   channel.clear();
//   console.log('   Workers terminated and channel cleared');

//   // Shutdown
//   console.log('\n11. Shutting down channel:');
//   channel.shutdown();
//   console.log('   Channel shutdown completed');
// }

// // Run the example with proper error handling and exit
// async function main() {
//   try {
//     await workerThreadIntegration();
//     console.log('\n=== Example completed successfully ===');
//   } catch (error) {
//     console.error('\n=== Example failed ===');
//     console.error('Error:', error.message);
//     console.error('Stack:', error.stack);
//   } finally {
//     // Force exit after a short delay to ensure cleanup
//     setTimeout(() => {
//       console.log('Forcing exit...');
//       process.exit(0);
//     }, 1000);
//   }
// }

// main();
