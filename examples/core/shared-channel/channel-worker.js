// // @ts-check
// import { parentPort, workerData } from 'worker_threads';

// console.log(`Channel Worker ${workerData.workerId} starting...`);

// async function runWorker() {
//   try {
//     console.log(
//       `Worker ${workerData.workerId} running for channel: ${workerData.channelId}`
//     );

//     // Simulate some processing work
//     await new Promise(resolve => setTimeout(resolve, 1000));

//     // Send completion message back to main thread
//     if (parentPort) {
//       parentPort.postMessage(
//         `Worker ${workerData.workerId} completed processing for channel ${workerData.channelId}`
//       );
//     }

//     console.log(`Worker ${workerData.workerId} completed`);
//   } catch (error) {
//     console.error(`Worker ${workerData.workerId} error:`, error.message);
//     if (parentPort) {
//       parentPort.postMessage(
//         `Worker ${workerData.workerId} error: ${error.message}`
//       );
//     }
//   }
// }

// // Start the worker and handle errors
// runWorker().catch(error => {
//   console.error(`Worker ${workerData.workerId} fatal error:`, error.message);
//   process.exit(1);
// });
