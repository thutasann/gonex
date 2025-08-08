function runHeavyTasksSequentially(tasks) {
  const results = [];

  return new Promise(resolve => {
    let index = 0;

    function runNext() {
      if (index >= tasks.length) {
        return resolve(results);
      }

      setImmediate(() => {
        const result = tasks[index++](); // sync task
        results.push(result);
        runNext(); // next task
      });
    }

    runNext();
  });
}

export default runHeavyTasksSequentially;
