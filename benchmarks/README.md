# Gonex Benchmark Suite

A comprehensive benchmarking suite for testing the performance of Gonex concurrency primitives, with a focus on goroutines and their various execution modes.

## Features

- **Comprehensive Testing**: Tests all goroutine functionality including `go`, `goAll`, `goRace`, and `goWithRetry`
- **Performance Comparison**: Event-loop vs Worker-thread performance analysis
- **Scaling Tests**: Performance analysis with different task counts
- **Memory Usage**: Memory consumption and garbage collection analysis
- **Detailed Reports**: Both console output and markdown reports
- **Statistical Analysis**: Average, min, max, and standard deviation calculations

## Quick Start

### Prerequisites

1. Build the main package first:

```bash
npm run build
```

2. Install benchmark dependencies:

```bash
cd benchmarks
npm install
```

### Running Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Run only goroutine benchmarks
npm run benchmark:goroutines

# Generate report from existing results
npm run report

# Clean results
npm run clean
```

## Benchmark Categories

### 1. Basic Functionality Tests

- **Simple Goroutine**: Basic goroutine creation and execution
- **Async Goroutine**: Goroutines with async operations
- **goRace**: Race condition testing
- **goWithRetry**: Retry mechanism performance
- **Error Handling**: Error propagation and handling

### 2. Performance Comparison Tests

- **CPU-Intensive Tasks**: Event-loop vs Worker-thread comparison
- **Mixed Workload**: Combination of CPU and I/O tasks
- **Scaling Tests**: Performance with different task counts (10, 50, 100, 200)

### 3. Memory Usage Tests

- **Memory Consumption**: Heap usage analysis
- **Garbage Collection**: Memory cleanup efficiency

## Understanding Results

### Performance Metrics

- **Average**: Mean execution time across multiple iterations
- **Min/Max**: Best and worst case performance
- **Standard Deviation**: Consistency of performance
- **Improvement**: Percentage improvement when using worker threads

### Execution Modes

- **Event-Loop**: Single-threaded execution using Node.js event loop
- **Worker-Threads**: Multi-threaded execution using Node.js worker threads

### Recommendations

- Use **Event-Loop** for I/O-bound tasks and lightweight operations
- Use **Worker-Threads** for CPU-intensive tasks requiring true parallelism
- Monitor memory usage for long-running applications

## Output Files

The benchmark suite generates several output files in the `results/` directory:

- `benchmark-results-{timestamp}.json`: Raw benchmark data
- `benchmark-report-{timestamp}.md`: Formatted markdown report

## Example Output

```
📊 Benchmark Results Summary

🔄 Goroutine Benchmarks:

✅ Simple Goroutine:
   Average: 2.34ms
   Min: 1.89ms
   Max: 3.12ms
   Std Dev: 0.45ms

⚡ CPU-Intensive Performance Comparison:
   Event-Loop: 8.45s
   Worker-Threads: 3.12s
   Improvement: +63.1%

📈 goAll Scaling Performance:
   10 tasks:
     Event-Loop: 15.2ms
     Worker-Threads: 12.8ms
     Improvement: +15.8%
```

## Configuration

### Benchmark Settings

You can modify benchmark parameters in the individual benchmark files:

- **Iterations**: Number of times each benchmark runs (default: 5)
- **Task Counts**: Different scaling test sizes
- **CPU Intensity**: Complexity of CPU-intensive tasks
- **Memory Test Size**: Amount of data for memory tests

### System Requirements

- Node.js 16.0.0 or higher
- Multi-core CPU for worker thread tests
- Sufficient memory for memory usage tests

## Contributing

To add new benchmarks:

1. Create a new benchmark function in the appropriate file
2. Add it to the main benchmark runner
3. Update the report generator to include new metrics
4. Test with different system configurations

## Troubleshooting

### Common Issues

1. **Build Required**: Always run `npm run build` in the main directory first
2. **Memory Issues**: Reduce task counts for systems with limited memory
3. **Timeout Errors**: Increase timeout values for slower systems
4. **Worker Thread Errors**: Ensure Node.js supports worker threads

### Performance Tips

- Run benchmarks on a dedicated machine
- Close other applications during testing
- Use consistent system load conditions
- Run multiple iterations for accurate results

## License

MIT License - see main project LICENSE file for details.
