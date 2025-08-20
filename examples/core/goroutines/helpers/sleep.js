function js_sleep(duration) {
  return new Promise(resolve => {
    setTimeout(resolve, duration);
  });
}

export default js_sleep;
