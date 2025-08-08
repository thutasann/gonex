const workerThreadTasks = [
  () => {
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    return { task: 1, result: result.toFixed(2) };
  },
  () => {
    let result = 0;
    for (let i = 0; i < 2000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    return { task: 2, result: result.toFixed(2) };
  },
  () => {
    let result = 0;
    for (let i = 0; i < 3000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    return { task: 3, result: result.toFixed(2) };
  },
  () => {
    let result = 0;
    for (let i = 0; i < 4000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    return { task: 4, result: result.toFixed(2) };
  },
];

export default workerThreadTasks;
