const heavyWorkerThreadTasks = [
  () => {
    let result = 0;
    for (let i = 0; i < 10000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i);
    }
    return { task: 1, result: result.toFixed(2) };
  },
  () => {
    let result = 0;
    for (let i = 0; i < 15000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i);
    }
    return { task: 2, result: result.toFixed(2) };
  },
  () => {
    let result = 0;
    for (let i = 0; i < 20000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i);
    }
    return { task: 3, result: result.toFixed(2) };
  },
  () => {
    let result = 0;
    for (let i = 0; i < 25000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i);
    }
    return { task: 4, result: result.toFixed(2) };
  },
];

export default heavyWorkerThreadTasks;
