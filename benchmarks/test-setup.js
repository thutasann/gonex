// @ts-check
import chalk from 'chalk';
import { go, goAll } from 'gonex';

console.log(chalk.blue('🧪 Testing Benchmark Setup...\n'));

async function testBasicGoroutine() {
  console.log(chalk.yellow('Testing basic goroutine...'));

  const start = performance.now();
  const result = await go(() => 'Hello from goroutine!');
  const end = performance.now();

  console.log(chalk.green('✅ Basic goroutine test passed'));
  console.log(`   Result: ${result}`);
  console.log(`   Time: ${(end - start).toFixed(2)}ms\n`);
}

async function testGoAll() {
  console.log(chalk.yellow('Testing goAll...'));

  const tasks = Array.from({ length: 5 }, (_, i) => () => `Task ${i + 1}`);

  const start = performance.now();
  const results = await goAll(tasks);
  const end = performance.now();

  console.log(chalk.green('✅ goAll test passed'));
  console.log(`   Results: ${results.join(', ')}`);
  console.log(`   Time: ${(end - start).toFixed(2)}ms\n`);
}

async function testWorkerThreads() {
  console.log(chalk.yellow('Testing worker threads...'));

  const cpuIntensiveTask = () => {
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      result += Math.sqrt(i);
    }
    return result;
  };

  const tasks = Array.from({ length: 2 }, () => cpuIntensiveTask);

  const start = performance.now();
  const results = await goAll(tasks, { useWorkerThreads: true });
  const end = performance.now();

  console.log(chalk.green('✅ Worker threads test passed'));
  console.log(`   Results: ${results.map(r => r.toFixed(2)).join(', ')}`);
  console.log(`   Time: ${(end - start).toFixed(2)}ms\n`);
}

async function runTests() {
  try {
    await testBasicGoroutine();
    await testGoAll();
    await testWorkerThreads();

    console.log(
      chalk.bold.green('🎉 All tests passed! Benchmark setup is ready.')
    );
    console.log(
      chalk.gray('\nRun "npm run benchmark" to start the full benchmark suite.')
    );
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
