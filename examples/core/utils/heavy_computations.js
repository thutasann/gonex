const heavy_computations = [
  () => {
    console.log('Starting computation 1...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Computation 1 completed with result:', result.toFixed(2));
    return { id: 1, result: result.toFixed(2) };
  },
  () => {
    console.log('Starting computation 2...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Computation 2 completed with result:', result.toFixed(2));
    return { id: 2, result: result.toFixed(2) };
  },
  () => {
    console.log('Starting computation 3...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Computation 3 completed with result:', result.toFixed(2));
    return { id: 3, result: result.toFixed(2) };
  },
  () => {
    console.log('Starting computation 4...');
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('Computation 4 completed with result:', result.toFixed(2));
    return { id: 4, result: result.toFixed(2) };
  },
];

export default heavy_computations;
