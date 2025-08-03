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

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(
      resultsDir,
      `benchmark-results-${timestamp}.json`
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
  }
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks();
}
