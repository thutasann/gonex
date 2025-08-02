const workerThreadTasks = [
  () => {
    console.log('Worker Thread Task 1: Starting heavy computation...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Worker Thread Task 1: Heavy computation completed');
    return { task: 1, result: result.toFixed(2) };
  },
  () => {
    console.log('Worker Thread Task 2: Starting heavy computation...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Worker Thread Task 2: Heavy computation completed');
    return { task: 2, result: result.toFixed(2) };
  },
  () => {
    console.log('Worker Thread Task 3: Starting heavy computation...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Worker Thread Task 3: Heavy computation completed');
    return { task: 3, result: result.toFixed(2) };
  },
  () => {
    console.log('Worker Thread Task 4: Starting heavy computation...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Worker Thread Task 4: Heavy computation completed');
    return { task: 4, result: result.toFixed(2) };
  },
];

export default workerThreadTasks;
