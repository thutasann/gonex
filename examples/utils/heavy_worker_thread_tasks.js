const heavyWorkerThreadTasks = [
  () => {
    console.log('Heavy Task 1: Starting intensive computation...');
    let result = 0;
    for (let i = 0; i < 10000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i);
    }
    console.log('Heavy Task 1: Completed');
    return { task: 1, result: result.toFixed(2) };
  },
  () => {
    console.log('Heavy Task 2: Starting intensive computation...');
    let result = 0;
    for (let i = 0; i < 15000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i);
    }
    console.log('Heavy Task 2: Completed');
    return { task: 2, result: result.toFixed(2) };
  },
  () => {
    console.log('Heavy Task 3: Starting intensive computation...');
    let result = 0;
    for (let i = 0; i < 20000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i);
    }
    console.log('Heavy Task 3: Completed');
    return { task: 3, result: result.toFixed(2) };
  },
  () => {
    console.log('Heavy Task 4: Starting intensive computation...');
    let result = 0;
    for (let i = 0; i < 25000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i);
    }
    console.log('Heavy Task 4: Completed');
    return { task: 4, result: result.toFixed(2) };
  },
];

export default heavyWorkerThreadTasks;
