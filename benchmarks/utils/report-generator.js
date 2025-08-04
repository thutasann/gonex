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

  // Generate sections for each benchmark type
  Object.entries(results).forEach(([benchmarkType, benchmarkResults]) => {
    if (!benchmarkResults || typeof benchmarkResults !== 'object') return;

    const sectionTitle =
      benchmarkType.charAt(0).toUpperCase() + benchmarkType.slice(1);
    console.log(chalk.yellow(`🔄 ${sectionTitle} Benchmarks:\n`));

    // Display basic functionality results
    Object.entries(benchmarkResults).forEach(([testName, testResult]) => {
      if (testResult && testResult.average !== undefined) {
        const displayName =
          testName.charAt(0).toUpperCase() + testName.slice(1);
        console.log(chalk.green(`✅ ${displayName}:`));
        console.log(`   Average: ${formatTime(testResult.average)}`);
        console.log(`   Min: ${formatTime(testResult.min)}`);
        console.log(`   Max: ${formatTime(testResult.max)}`);
        console.log(`   Std Dev: ${formatTime(testResult.stdDev)}\n`);
      }
    });

    // Display comparison results
    Object.entries(benchmarkResults).forEach(([testName, testResult]) => {
      if (testResult && testResult.eventLoop && testResult.workerThread) {
        const improvement = calculateImprovement(
          testResult.eventLoop.average,
          testResult.workerThread.average
        );

        const comparisonTitle =
          testName.charAt(0).toUpperCase() +
          testName.slice(1).replace(/([A-Z])/g, ' $1');
        console.log(
          chalk.green(`⚡ ${comparisonTitle} Performance Comparison:`)
        );
        console.log(
          `   Event-Loop: ${formatTime(testResult.eventLoop.average)}`
        );
        console.log(
          `   Worker-Threads: ${formatTime(testResult.workerThread.average)}`
        );
        console.log(`   Improvement: ${improvement}\n`);
      }
    });

    // Display scaling results
    Object.entries(benchmarkResults).forEach(([testName, testResult]) => {
      if (
        testResult &&
        typeof testResult === 'object' &&
        !testResult.average &&
        !testResult.eventLoop
      ) {
        const scalingTitle =
          testName.charAt(0).toUpperCase() +
          testName.slice(1).replace(/([A-Z])/g, ' $1');
        console.log(chalk.green(`📈 ${scalingTitle}:`));
        Object.entries(testResult).forEach(([scaleKey, scaleResult]) => {
          if (
            scaleResult &&
            scaleResult.eventLoop &&
            scaleResult.workerThread
          ) {
            const improvement = calculateImprovement(
              scaleResult.eventLoop.average,
              scaleResult.workerThread.average
            );
            console.log(`   ${scaleKey}:`);
            console.log(
              `     Event-Loop: ${formatTime(scaleResult.eventLoop.average)}`
            );
            console.log(
              `     Worker-Threads: ${formatTime(scaleResult.workerThread.average)}`
            );
            console.log(`     Improvement: ${improvement}`);
          }
        });
        console.log();
      }
    });

    // Display memory usage results
    Object.entries(benchmarkResults).forEach(([testName, testResult]) => {
      if (testResult && testResult.memoryDiff) {
        const { memoryDiff } = testResult;
        const memoryTitle =
          testName.charAt(0).toUpperCase() +
          testName.slice(1).replace(/([A-Z])/g, ' $1');
        console.log(chalk.green(`💾 ${memoryTitle}:`));
        console.log(`   Heap Used: ${formatBytes(memoryDiff.heapUsed)}`);
        console.log(`   Heap Total: ${formatBytes(memoryDiff.heapTotal)}`);
        console.log(`   External: ${formatBytes(memoryDiff.external)}\n`);
      }
    });
  });
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

`;

  // Generate sections for each benchmark type
  Object.entries(results).forEach(([benchmarkType, benchmarkResults]) => {
    if (!benchmarkResults || typeof benchmarkResults !== 'object') return;

    // Add section header
    const sectionTitle =
      benchmarkType.charAt(0).toUpperCase() + benchmarkType.slice(1);
    markdown += `## ${sectionTitle} Benchmarks\n\n`;

    // Generate basic functionality table
    const basicData = [];
    Object.entries(benchmarkResults).forEach(([testName, testResult]) => {
      if (testResult && testResult.average !== undefined) {
        basicData.push([
          testName.charAt(0).toUpperCase() + testName.slice(1),
          formatTime(testResult.average),
          formatTime(testResult.min),
          formatTime(testResult.max),
          formatTime(testResult.stdDev),
        ]);
      }
    });

    if (basicData.length > 0) {
      markdown += `### Basic Functionality\n\n`;
      markdown += markdownTable([
        ['Benchmark', 'Average', 'Min', 'Max', 'Std Dev'],
        ...basicData,
      ]);
      markdown += '\n';
    }

    // Handle comparison results (like CPU-intensive comparisons)
    Object.entries(benchmarkResults).forEach(([testName, testResult]) => {
      if (testResult && testResult.eventLoop && testResult.workerThread) {
        const improvement = calculateImprovement(
          testResult.eventLoop.average,
          testResult.workerThread.average
        );

        const comparisonTitle =
          testName.charAt(0).toUpperCase() +
          testName.slice(1).replace(/([A-Z])/g, ' $1');
        markdown += `### ${comparisonTitle} Performance Comparison\n\n`;
        markdown += `| Mode | Average | Min | Max | Std Dev |\n`;
        markdown += `|------|---------|-----|-----|---------|\n`;
        markdown += `| Event-Loop | ${formatTime(testResult.eventLoop.average)} | ${formatTime(testResult.eventLoop.min)} | ${formatTime(testResult.eventLoop.max)} | ${formatTime(testResult.eventLoop.stdDev)} |\n`;
        markdown += `| Worker-Threads | ${formatTime(testResult.workerThread.average)} | ${formatTime(testResult.workerThread.min)} | ${formatTime(testResult.workerThread.max)} | ${formatTime(testResult.workerThread.stdDev)} |\n\n`;
        markdown += `**Performance Improvement:** ${improvement}\n\n`;
      }
    });

    // Handle scaling results
    Object.entries(benchmarkResults).forEach(([testName, testResult]) => {
      if (
        testResult &&
        typeof testResult === 'object' &&
        !testResult.average &&
        !testResult.eventLoop
      ) {
        // This might be a scaling result object
        const scalingData = [];
        Object.entries(testResult).forEach(([scaleKey, scaleResult]) => {
          if (
            scaleResult &&
            scaleResult.eventLoop &&
            scaleResult.workerThread
          ) {
            const improvement = calculateImprovement(
              scaleResult.eventLoop.average,
              scaleResult.workerThread.average
            );
            scalingData.push([
              scaleKey,
              formatTime(scaleResult.eventLoop.average),
              formatTime(scaleResult.workerThread.average),
              improvement,
            ]);
          }
        });

        if (scalingData.length > 0) {
          const scalingTitle =
            testName.charAt(0).toUpperCase() +
            testName.slice(1).replace(/([A-Z])/g, ' $1');
          markdown += `### ${scalingTitle}\n\n`;
          markdown += `| Scale | Event-Loop | Worker-Threads | Improvement |\n`;
          markdown += `|-------|------------|-----------------|-------------|\n`;
          scalingData.forEach(
            ([scale, eventLoop, workerThread, improvement]) => {
              markdown += `| ${scale} | ${eventLoop} | ${workerThread} | ${improvement} |\n`;
            }
          );
          markdown += '\n';
        }
      }
    });

    // Handle memory usage results
    Object.entries(benchmarkResults).forEach(([testName, testResult]) => {
      if (testResult && testResult.memoryDiff) {
        const { memoryDiff } = testResult;
        const memoryTitle =
          testName.charAt(0).toUpperCase() +
          testName.slice(1).replace(/([A-Z])/g, ' $1');
        markdown += `### ${memoryTitle}\n\n`;
        markdown += `| Metric | Value |\n`;
        markdown += `|--------|-------|\n`;
        markdown += `| Heap Used | ${formatBytes(memoryDiff.heapUsed)} |\n`;
        markdown += `| Heap Total | ${formatBytes(memoryDiff.heapTotal)} |\n`;
        markdown += `| External | ${formatBytes(memoryDiff.external)} |\n\n`;
      }
    });
  });

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
