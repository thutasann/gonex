import { sleep } from '../../dist/index.js';

/**
 * CPU-intensive task that will run in worker threads
 *
 * @param {any} data - The task data
 * @returns {Promise<{taskId: string, result: string}>} - The result of the task
 */
async function heavyTask(data) {
  let result = 0;
  for (let i = 0; i < 1000; i++) {
    await sleep(2);
    result += Math.sqrt(i) * Math.pow(i, 0.1);
  }
  return { taskId: data.id, result: result.toFixed(2) };
}

export default heavyTask;
