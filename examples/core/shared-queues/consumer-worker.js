import { parentPort, workerData } from 'worker_threads';

console.log('Consumer Worker starting...');

if (parentPort) {
  try {
    const { expectedItems } = workerData;

    console.log(`Consumer will process ${expectedItems} items`);

    let processedCount = 0;
    let emptyCount = 0;
    const maxEmptyAttempts = 100; // Prevent infinite loops

    // Process items by requesting dequeue operations from main thread
    while (processedCount < expectedItems && emptyCount < maxEmptyAttempts) {
      // Request dequeue from main thread
      parentPort.postMessage({
        type: 'dequeue_request',
      });

      // Wait for dequeue response
      const response = await new Promise((resolve, reject) => {
        const messageHandler = msg => {
          if (msg.type === 'dequeue_success') {
            parentPort.off('message', messageHandler);
            resolve({ success: true, item: msg.item });
          } else if (msg.type === 'dequeue_empty') {
            parentPort.off('message', messageHandler);
            resolve({ success: false, empty: true });
          } else if (msg.type === 'dequeue_error') {
            parentPort.off('message', messageHandler);
            reject(new Error(msg.error));
          }
        };

        parentPort.on('message', messageHandler);

        // Timeout after 5 seconds
        setTimeout(() => {
          parentPort.off('message', messageHandler);
          reject(new Error('Dequeue timeout'));
        }, 5000);
      });

      if (response.success) {
        processedCount++;
        console.log(
          `   Consumer processed item: ${JSON.stringify(response.item)}`
        );

        // Small delay to simulate processing
        await new Promise(resolve => setTimeout(resolve, 1));
      } else if (response.empty) {
        emptyCount++;
        // Wait a bit before trying again
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    console.log(`Consumer completed, processed ${processedCount} items`);

    // Notify completion
    parentPort.postMessage({
      type: 'complete',
      processedCount: processedCount,
    });
  } catch (error) {
    console.error('Consumer Worker error:', error);
    parentPort.postMessage({
      type: 'error',
      error: error.message,
    });
  }
}
