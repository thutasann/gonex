const binary_search = () => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ algorithm: 'binary', time: 150, result: 'found' });
    }, 150);
  });
};

export default binary_search;
