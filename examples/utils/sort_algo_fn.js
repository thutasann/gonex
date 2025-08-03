const sort_algo_fn = () => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ algorithm: 'linear', time: 300, result: 'found' });
    }, 300);
  });
};

export default sort_algo_fn;
