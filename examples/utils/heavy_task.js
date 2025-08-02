/**
 * CPU-intensive task that will run in worker threads
 *
 * @param {any} data - The task data
 * @returns {Promise<{taskId: string, result: string}>} - The result of the task
 */
const heavyTask = async data => {
  let result = 0;
  for (let i = 0; i < 5000000; i++) {
    result += Math.sqrt(i) * Math.pow(i, 0.1);
  }
  return { taskId: data.id, result: result.toFixed(2) };
};

export default heavyTask;
