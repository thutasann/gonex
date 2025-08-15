// /* eslint-disable no-constant-condition */
// // @ts-check
// import { parentPort, workerData } from 'worker_threads';

// console.log(`Worker ${workerData.workerId || 'main'} starting...`);

// async function runWorker() {
//   try {
//     // Check if this is a simple worker or the main worker
//     if (workerData.isSimpleWorker) {
//       // Simple worker - just read from input buffer and exit
//       console.log(`Worker ${workerData.workerId} is a simple worker`);

//       if (workerData.inputBuffer) {
//         // Read data from the shared buffer
//         const uint8View = new Uint8Array(workerData.inputBuffer);
//         const text = new TextDecoder().decode(uint8View).replace(/\0/g, '');
//         console.log(`Worker ${workerData.workerId} read: "${text}"`);

//         // Simulate some processing
//         await new Promise(resolve => setTimeout(resolve, 100));

//         // Send message back to main thread
//         if (parentPort) {
//           parentPort.postMessage(
//             `Worker ${workerData.workerId} processed: ${text.toUpperCase()}`
//           );
//         }
//       } else {
//         console.log(`Worker ${workerData.workerId} no input buffer provided`);
//       }

//       console.log(`Worker ${workerData.workerId} completed`);
//       return;
//     }

//     // Main worker - handle full communication protocol
//     console.log(`Worker ${workerData.workerId || 'main'} got shared buffers`);

//     // Get the shared buffers directly from workerData
//     const inputBuffer = workerData.inputBuffer;
//     const outputBuffer = workerData.outputBuffer;
//     const controlBuffer = workerData.controlBuffer;

//     if (!inputBuffer || !outputBuffer || !controlBuffer) {
//       throw new Error('Failed to get shared buffers from workerData');
//     }

//     // Wait for control signal with timeout
//     let controlData;
//     let attempts = 0;
//     const maxAttempts = 100; // 10 seconds max wait

//     do {
//       // Read control data directly from the buffer
//       const controlView = new Uint8Array(controlBuffer, 0, 2);
//       controlData = [controlView[0], controlView[1]];

//       if (controlData[0] === 1) {
//         // Data available
//         break;
//       }

//       attempts++;
//       if (attempts >= maxAttempts) {
//         console.log(
//           `Worker ${workerData.workerId || 'main'} timeout waiting for control signal`
//         );
//         return;
//       }

//       // Small delay to avoid busy waiting
//       await new Promise(resolve => setTimeout(resolve, 100));
//     } while (true);

//     const dataLength = controlData[1];
//     console.log(
//       `Worker ${workerData.workerId || 'main'} received control signal, data length: ${dataLength}`
//     );

//     // Read input data directly from the buffer
//     const inputView = new Uint8Array(inputBuffer, 0, dataLength);
//     const inputText = new TextDecoder().decode(inputView);
//     console.log(`Worker ${workerData.workerId || 'main'} read: "${inputText}"`);

//     // Process data (simulate work)
//     await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time

//     const processedText = `Processed by worker ${workerData.workerId || 'main'}: ${inputText.toUpperCase()}`;
//     const outputData = new TextEncoder().encode(processedText);

//     // Write output data directly to the buffer
//     const outputView = new Uint8Array(outputBuffer);
//     outputView.set(outputData, 0);
//     console.log(`Worker ${workerData.workerId || 'main'} wrote processed data`);

//     // Send completion signal directly to the control buffer
//     const controlView = new Uint8Array(controlBuffer);
//     controlView[0] = 2; // Signal: processing complete
//     controlView[1] = 0;
//     console.log(
//       `Worker ${workerData.workerId || 'main'} sent completion signal`
//     );

//     // Notify main thread
//     if (parentPort) {
//       parentPort.postMessage(
//         `Worker ${workerData.workerId || 'main'} completed processing`
//       );
//     }
//   } catch (error) {
//     console.error(
//       `Worker ${workerData.workerId || 'main'} error:`,
//       error.message
//     );
//     if (parentPort) {
//       parentPort.postMessage(
//         `Worker ${workerData.workerId || 'main'} error: ${error.message}`
//       );
//     }
//   } finally {
//     console.log(`Worker ${workerData.workerId || 'main'} completed`);
//   }
// }

// // Start the worker and handle errors
// runWorker().catch(error => {
//   console.error(
//     `Worker ${workerData.workerId || 'main'} fatal error:`,
//     error.message
//   );
//   process.exit(1);
// });

console.log('Worker started');
