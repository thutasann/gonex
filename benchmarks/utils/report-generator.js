// @ts-check
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { markdownTable } from 'markdown-table';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format milliseconds to human readable format
 */
function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Calculate performance improvement percentage
 */
function calculateImprovement(baseline, improved) {
  const improvement = ((baseline - improved) / baseline) * 100;
  return improvement > 0
    ? `+${improvement.toFixed(1)}%`
    : `${improvement.toFixed(1)}%`;
}

/**
 * Generate console output for benchmark results
 */
function generateConsoleReport(results) {
  console.log(chalk.bold.cyan('\n📊 Benchmark Results Summary\n'));

  if (results.goroutines) {
    console.log(chalk.yellow('🔄 Goroutine Benchmarks:\n'));

    // Basic functionality results
    if (results.goroutines.simple) {
      console.log(chalk.green('✅ Simple Goroutine:'));
      console.log(
        `   Average: ${formatTime(results.goroutines.simple.average)}`
      );
      console.log(`   Min: ${formatTime(results.goroutines.simple.min)}`);
      console.log(`   Max: ${formatTime(results.goroutines.simple.max)}`);
      console.log(
        `   Std Dev: ${formatTime(results.goroutines.simple.stdDev)}\n`
      );
    }

    if (results.goroutines.async) {
      console.log(chalk.green('✅ Async Goroutine:'));
      console.log(
        `   Average: ${formatTime(results.goroutines.async.average)}`
      );
      console.log(`   Min: ${formatTime(results.goroutines.async.min)}`);
      console.log(`   Max: ${formatTime(results.goroutines.async.max)}`);
      console.log(
        `   Std Dev: ${formatTime(results.goroutines.async.stdDev)}\n`
      );
    }

    // CPU-intensive comparison
    if (results.goroutines.cpuIntensive) {
      const { eventLoop, workerThread } = results.goroutines.cpuIntensive;
      const improvement = calculateImprovement(
        eventLoop.average,
        workerThread.average
      );

      console.log(chalk.green('⚡ CPU-Intensive Performance Comparison:'));
      console.log(`   Event-Loop: ${formatTime(eventLoop.average)}`);
      console.log(`   Worker-Threads: ${formatTime(workerThread.average)}`);
      console.log(`   Improvement: ${improvement}\n`);
    }

    // Scaling results
    if (results.goroutines.goAllScaling) {
      console.log(chalk.green('📈 goAll Scaling Performance:'));
      Object.entries(results.goroutines.goAllScaling).forEach(
        ([taskCount, result]) => {
          const improvement = calculateImprovement(
            result.eventLoop.average,
            result.workerThread.average
          );
          console.log(`   ${taskCount} tasks:`);
          console.log(
            `     Event-Loop: ${formatTime(result.eventLoop.average)}`
          );
          console.log(
            `     Worker-Threads: ${formatTime(result.workerThread.average)}`
          );
          console.log(`     Improvement: ${improvement}`);
        }
      );
      console.log();
    }

    // Memory usage
    if (results.goroutines.memoryUsage) {
      const { memoryDiff } = results.goroutines.memoryUsage;
      console.log(chalk.green('💾 Memory Usage:'));
      console.log(`   Heap Used: ${formatBytes(memoryDiff.heapUsed)}`);
      console.log(`   Heap Total: ${formatBytes(memoryDiff.heapTotal)}`);
      console.log(`   External: ${formatBytes(memoryDiff.external)}\n`);
    }
  }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results, timestamp) {
  let markdown = `# Gonex Benchmark Results

**Generated:** ${new Date().toISOString()}
**Timestamp:** ${timestamp}

## Overview

This report contains comprehensive benchmark results for the Gonex concurrency primitives, focusing on performance, scalability, and memory usage.

## Goroutine Benchmarks

### Basic Functionality

`;

  if (results.goroutines) {
    // Basic functionality table
    const basicData = [];
    if (results.goroutines.simple) {
      basicData.push([
        'Simple Goroutine',
        formatTime(results.goroutines.simple.average),
        formatTime(results.goroutines.simple.min),
        formatTime(results.goroutines.simple.max),
        formatTime(results.goroutines.simple.stdDev),
      ]);
    }
    if (results.goroutines.async) {
      basicData.push([
        'Async Goroutine',
        formatTime(results.goroutines.async.average),
        formatTime(results.goroutines.async.min),
        formatTime(results.goroutines.async.max),
        formatTime(results.goroutines.async.stdDev),
      ]);
    }
    if (results.goroutines.goRace) {
      basicData.push([
        'goRace',
        formatTime(results.goroutines.goRace.average),
        formatTime(results.goroutines.goRace.min),
        formatTime(results.goroutines.goRace.max),
        formatTime(results.goroutines.goRace.stdDev),
      ]);
    }
    if (results.goroutines.goWithRetry) {
      basicData.push([
        'goWithRetry',
        formatTime(results.goroutines.goWithRetry.average),
        formatTime(results.goroutines.goWithRetry.min),
        formatTime(results.goroutines.goWithRetry.max),
        formatTime(results.goroutines.goWithRetry.stdDev),
      ]);
    }

    markdown += markdownTable([
      ['Benchmark', 'Average', 'Min', 'Max', 'Std Dev'],
      ...basicData,
    ]);

    // CPU-intensive comparison
    if (results.goroutines.cpuIntensive) {
      const { eventLoop, workerThread } = results.goroutines.cpuIntensive;
      const improvement = calculateImprovement(
        eventLoop.average,
        workerThread.average
      );

      markdown += `

### CPU-Intensive Performance Comparison

| Mode | Average | Min | Max | Std Dev |
|------|---------|-----|-----|---------|
| Event-Loop | ${formatTime(eventLoop.average)} | ${formatTime(eventLoop.min)} | ${formatTime(eventLoop.max)} | ${formatTime(eventLoop.stdDev)} |
| Worker-Threads | ${formatTime(workerThread.average)} | ${formatTime(workerThread.min)} | ${formatTime(workerThread.max)} | ${formatTime(workerThread.stdDev)} |

**Performance Improvement:** ${improvement}
`;
    }

    // Scaling results
    if (results.goroutines.goAllScaling) {
      markdown += `

### goAll Scaling Performance

| Task Count | Event-Loop | Worker-Threads | Improvement |
|------------|------------|-----------------|-------------|
`;

      Object.entries(results.goroutines.goAllScaling).forEach(
        ([taskCount, result]) => {
          const improvement = calculateImprovement(
            result.eventLoop.average,
            result.workerThread.average
          );
          markdown += `| ${taskCount} | ${formatTime(result.eventLoop.average)} | ${formatTime(result.workerThread.average)} | ${improvement} |\n`;
        }
      );
    }

    // Memory usage
    if (results.goroutines.memoryUsage) {
      const { memoryDiff } = results.goroutines.memoryUsage;
      markdown += `

### Memory Usage

| Metric | Value |
|--------|-------|
| Heap Used | ${formatBytes(memoryDiff.heapUsed)} |
| Heap Total | ${formatBytes(memoryDiff.heapTotal)} |
| External | ${formatBytes(memoryDiff.external)} |
`;
    }
  }

  markdown += `

## Performance Insights

### Event-Loop vs Worker-Threads

- **Event-Loop**: Best for I/O-bound tasks and lightweight operations
- **Worker-Threads**: Optimal for CPU-intensive tasks with true parallelism
- **Scaling**: Worker threads show significant improvement as task complexity increases

### Recommendations

1. Use **Event-Loop** mode for:
   - Simple async operations
   - I/O-bound tasks
   - Lightweight computations

2. Use **Worker-Threads** mode for:
   - CPU-intensive calculations
   - Heavy mathematical operations
   - Parallel data processing

## System Information

- **Node.js Version:** ${process.version}
- **Platform:** ${process.platform}
- **Architecture:** ${process.arch}
- **CPU Cores:** ${os.cpus().length}

---

*Generated by Gonex Benchmark Suite*
`;

  return markdown;
}

/**
 * Save markdown report to file with date-based organization
 */
function saveMarkdownReport(markdown, timestamp) {
  const resultsDir = path.join(__dirname, '..', 'results');

  // Parse timestamp to get date components
  // Handle different timestamp formats
  let date;
  if (timestamp.includes('T')) {
    // ISO string format
    date = new Date(timestamp);
  } else {
    // Custom format with dashes (e.g., "2025-01-15-14-30-25")
    const parts = timestamp.split('-');
    if (parts.length >= 6) {
      const [year, month, day, hour, minute, second] = parts;
      date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    } else {
      // Fallback to current date
      date = new Date();
    }
  }

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

  // Save to date/time specific directory only
  const reportFile = path.join(timeDir, `benchmark-report-${timestamp}.md`);
  fs.writeFileSync(reportFile, markdown);

  return { reportFile, dateFolder, timeFolder, dateDir };
}

/**
 * Generate comprehensive benchmark report
 */
export async function generateReport(results, timestamp) {
  // Generate console output
  generateConsoleReport(results);

  // Generate markdown report
  const markdown = generateMarkdownReport(results, timestamp);
  const { reportFile, dateFolder, timeFolder, dateDir } = saveMarkdownReport(
    markdown,
    timestamp
  );

  console.log(chalk.green(`📝 Report saved to: ${reportFile}`));
  console.log(chalk.blue(`📅 Date: ${dateFolder}`));
  console.log(chalk.blue(`🕐 Time: ${timeFolder}`));
  console.log(chalk.blue(`📂 Directory: ${dateDir}/${timeFolder}`));
}
