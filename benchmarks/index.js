// @ts-check
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Banner
console.log(
  chalk.greenBright(`
    ██████╗  ██████╗ ███╗  ██╗███████╗██╗  ██╗
   ██╔════╝ ██╔═══██╗████╗ ██║██╔════╝██║ ██╔╝
   ██║  ███╗██║   ██║██╔██╗██║█████╗  █████╔╝ 
   ██║   ██║██║   ██║██║╚████║██╔══╝  ██╔═██╗ 
   ╚██████╔╝╚██████╔╝██║ ╚███║███████╗██║  ██╗
    ╚═════╝  ╚═════╝ ╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝
 `)
);

console.log(
  chalk.bold.cyan(`\n⚡ Gonex Benchmark Suite`),
  chalk.whiteBright(`– Performance Testing for Concurrency Primitives\n`)
);

// Import benchmark modules
import { runGoroutineBenchmarks } from './benchmarks/goroutines.js';
import { generateReport } from './utils/report-generator.js';
import { shutdownParallelScheduler } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure results directory exists
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Main benchmark runner
 */
async function runBenchmarks() {
  const startTime = Date.now();
  const results = {};

  try {
    console.log(chalk.yellow('🚀 Starting Benchmark Suite...\n'));

    // Run goroutine benchmarks
    console.log(chalk.blue('📊 Running Goroutine Benchmarks...'));
    results.goroutines = await runGoroutineBenchmarks();
    console.log(chalk.green('✅ Goroutine benchmarks completed\n'));

    // Save results in date-based folder structure
    const timestamp = new Date().toISOString();
    const date = new Date(timestamp);
    const dateFolder = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeFolder = date
      .toISOString()
      .split('T')[1]
      .split('.')[0]
      .replace(/:/g, '-'); // HH-MM-SS

    // Create date-based directory structure
    const dateDir = path.join(resultsDir, dateFolder);
    const timeDir = path.join(dateDir, timeFolder);

    // Create directories if they don't exist
    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }
    if (!fs.existsSync(timeDir)) {
      fs.mkdirSync(timeDir, { recursive: true });
    }

    // Save results in date/time folder
    const resultsFile = path.join(
      timeDir,
      `benchmark-results-${timestamp.replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

    // Generate report
    console.log(chalk.blue('📝 Generating Report...'));
    await generateReport(results, timestamp);

    const totalTime = Date.now() - startTime;
    console.log(
      chalk.green(`\n🎉 Benchmark suite completed in ${totalTime}ms`),
      chalk.gray(`\n📁 Results saved to: ${resultsFile}`)
    );
  } catch (error) {
    console.error(chalk.red('❌ Benchmark suite failed:'), error);
    process.exit(1);
  } finally {
    console.log(chalk.blue('\n🔄 Shutting down parallel scheduler...'));
    await shutdownParallelScheduler();

    // Force exit after a short delay to ensure cleanup
    setTimeout(() => {
      console.log(chalk.green('✅ Process cleanup complete'));
      process.exit(0);
    }, 100);
  }
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks();
}
