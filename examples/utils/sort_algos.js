const sort_algorithms = [
  () => {
    console.log('Algorithm 1: Starting linear search...');
    // Simulate different search times
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('Algorithm 1: Found result in 200ms');
        resolve({ algorithm: 'linear', time: 200, result: 'found' });
      }, 200);
    });
  },
  () => {
    console.log('Algorithm 2: Starting binary search...');
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('Algorithm 2: Found result in 150ms');
        resolve({ algorithm: 'binary', time: 150, result: 'found' });
      }, 150);
    });
  },
  () => {
    console.log('Algorithm 3: Starting hash search...');
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('Algorithm 3: Found result in 100ms');
        resolve({ algorithm: 'hash', time: 100, result: 'found' });
      }, 100);
    });
  },
];

export default sort_algorithms;
