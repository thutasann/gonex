import { parentPort, workerData } from 'worker_threads';

console.log(`Producer Worker ${workerData.workerId} starting...`);

if (parentPort) {
  try {
    const { workerId, itemCount } = workerData;

    console.log(`Worker ${workerId} will produce ${itemCount} items`);

    // Produce items by requesting enqueue operations from main thread
    for (let i = 0; i < itemCount; i++) {
      const item = {
        id: workerId * itemCount + i,
        data: `Data from worker ${workerId}, item ${i}`,
      };

      // Request enqueue from main thread
      parentPort.postMessage({
        type: 'enqueue',
        item: item,
      });

      // Wait for enqueue response
      const response = await new Promise((resolve, reject) => {
        const messageHandler = msg => {
          if (msg.type === 'enqueue_success' && msg.itemId === item.id) {
            parentPort.off('message', messageHandler);
            resolve({ success: true });
          } else if (msg.type === 'enqueue_failed' && msg.itemId === item.id) {
            parentPort.off('message', messageHandler);
            resolve({ success: false });
          } else if (msg.type === 'enqueue_error' && msg.itemId === item.id) {
            parentPort.off('message', messageHandler);
            reject(new Error(msg.error));
          }
        };

        parentPort.on('message', messageHandler);

        // Timeout after 5 seconds
        setTimeout(() => {
          parentPort.off('message', messageHandler);
          reject(new Error('Enqueue timeout'));
        }, 5000);
      });

      if (!response.success) {
        console.log(`Worker ${workerId} failed to enqueue item ${i}`);
      }

      // Small delay to simulate work
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    console.log(`Worker ${workerId} completed producing ${itemCount} items`);

    // Notify completion
    parentPort.postMessage({
      type: 'complete',
      workerId: workerId,
      itemCount: itemCount,
    });
  } catch (error) {
    console.error(`Producer Worker ${workerData.workerId} error:`, error);
    parentPort.postMessage({
      type: 'error',
      workerId: workerData.workerId,
      error: error.message,
    });
  }
}
