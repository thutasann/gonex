const eventLoopTasks = [
  () => {
    console.log('Event Loop Task 1: Processing lightweight operation...');
    return new Promise(resolve => {
      setTimeout(() => resolve('Event Loop Result 1'), 100);
    });
  },
  () => {
    console.log('Event Loop Task 2: Processing lightweight operation...');
    return new Promise(resolve => {
      setTimeout(() => resolve('Event Loop Result 2'), 150);
    });
  },
  () => {
    console.log('Event Loop Task 3: Processing lightweight operation...');
    return new Promise(resolve => {
      setTimeout(() => resolve('Event Loop Result 3'), 200);
    });
  },
];

export default eventLoopTasks;
