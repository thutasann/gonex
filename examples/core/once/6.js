// @ts-check
import {
  go,
  initializeParallelScheduler,
  once,
  shutdownParallelScheduler,
  sleep,
} from '../../../dist/index.js';

async function onceWorkerExample() {
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Example 5: Once with cleanup
    let resource = null;
    const cleanupOnce = once({ name: 'cleanupOnce' });
    cleanupOnce.do(async () => {
      console.log('   Creating resource...');
      await sleep(100);
      resource = { id: 'resource-1', status: 'active' };
      console.log('   Resource created', resource);
    });

    go(async () => {
      await cleanupOnce.do(async () => {
        console.log('   Creating resource...');
        await sleep(100);
        resource = { id: 'resource-1', status: 'active' };
        console.log('   Resource created', resource);
      });
      console.log('   First call completed');

      // Simulate cleanup after some time
      await sleep(300);
      console.log('   Cleaning up resource...');
      resource = null;
      console.log('   Resource cleaned up');
    });

    go(async () => {
      await cleanupOnce.do(async () => {
        console.log('   Creating resource...');
        await sleep(100);
        resource = { id: 'resource-1', status: 'active' };
        console.log('   Resource created', resource);
      });
      console.log('   Second call completed (should reuse same resource)');
    });
  } catch (error) {
    console.error(error);
  } finally {
    await shutdownParallelScheduler();
  }
}

onceWorkerExample().catch(console.error);
