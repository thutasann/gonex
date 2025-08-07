# High-Performance Go-Inspired Concurrency with True Parallelism for Node.js

A comprehensive TypeScript library that brings Go's powerful concurrency primitives to Node.js with **true parallelism** using Worker Threads, enabling robust, scalable concurrent programming patterns with multi-core performance.

## Features

### Core Concurrency Primitives

- **Goroutines** - Lightweight concurrent functions with automatic scheduling
- **Channels** - Typed communication between goroutines (buffered/unbuffered)
- **Select** - Non-blocking channel operations with multiple cases
- **WaitGroup** - Synchronization for multiple goroutines
- **Mutex** - Mutual exclusion locks for shared resources
- **RWMutex** - Read-write mutex for concurrent read access
- **Once** - One-time initialization guarantees
- **Cond** - Condition variables for signaling
- **Semaphore** - Resource limiting and access control
- **Context** - Cancellation, deadlines, and request-scoped values

### True Parallelism with Worker Threads

- **Multi-Core Execution** - Utilize all CPU cores for CPU-intensive tasks
- **Automatic Load Balancing** - Round-robin distribution across worker threads
- **Performance Optimized** - Minimal overhead with direct function execution
- **Smart Fallback** - Automatic fallback to event-loop for I/O-bound tasks
- **Execution Mode Tracking** - Clear logging of event-loop vs worker-thread execution
- **External Imports** - Support for Node.js built-in modules and third-party packages in worker threads

### Timing and Scheduling

- **Ticker** - Periodic events with configurable intervals
- **Timer** - One-time delayed events
- **Sleep** - Cooperative yielding and delays

### Advanced Patterns

- **Worker Pool** - Managed goroutine pools for controlled concurrency
- **Pipeline** - Chained processing with backpressure
- **Fan-out/Fan-in** - Parallel processing patterns
- **Rate Limiter** - Request throttling and rate control
- **Circuit Breaker** - Fault tolerance and failure handling
- **Retry** - Automatic retry mechanisms with exponential backoff

## Installation

```bash
npm install gonex
```

## 📦 NPM Package

This package is available on npm as [**gonex**](https://www.npmjs.com/package/gonex).

[![npm version](https://img.shields.io/npm/v/gonex.svg)](https://www.npmjs.com/package/gonex)
[![npm downloads](https://img.shields.io/npm/dm/gonex.svg)](https://www.npmjs.com/package/gonex)
[![npm license](https://img.shields.io/npm/l/gonex.svg)](https://www.npmjs.com/package/gonex)

**Install with:**

```bash
npm install gonex
# or
yarn add gonex
# or
pnpm add gonex
```

## Quick Start

````typescript
import { go, channel, select, waitGroup } from 'gonex';

// Simple goroutine (event-loop)
go(async () => {
  console.log('Hello from goroutine!');
});

// Channel communication
const ch = channel<string>();
go(async () => {
  await ch.send('Hello from sender!');
});

go(async () => {
  const msg = await ch.receive();
  console.log(msg); // "Hello from sender!"
});

// WaitGroup synchronization
const wg = waitGroup();
for (let i = 0; i < 3; i++) {
  wg.add(1);
  go(async () => {
    await sleep(1000);
    console.log('Worker completed');
    wg.done();
  });
}
await wg.wait();
console.log('All workers completed');

// External imports in worker threads
import { initializeParallelScheduler, shutdownParallelScheduler } from 'gonex';

await initializeParallelScheduler({ useWorkerThreads: true });

const result = await go(
  async () => {
    const fs = await import('node:fs');
    const crypto = await import('node:crypto');

    return {
      fileExists: fs.existsSync('/tmp/test'),
      randomBytes: crypto.randomBytes(4).toString('hex'),
    };
  },
  [],
  { useWorkerThreads: true }
);

await shutdownParallelScheduler();

## 🚀 Parallelism Examples

### CPU-Intensive Tasks with True Parallelism

```typescript
import { go, goAll } from 'gonex';

// CPU-intensive tasks run in parallel across multiple cores
const heavyTasks = [
  () => {
    let result = 0;
    for (let i = 0; i < 1000000000; i++) {
      result += Math.sqrt(i);
    }
    return result;
  },
  () => {
    let result = 0;
    for (let i = 0; i < 1000000000; i++) {
      result += Math.pow(i, 2);
    }
    return result;
  },
];

// Execute in parallel using worker threads
const results = await goAll(heavyTasks, [], { useWorkerThreads: true });
console.log('All tasks completed in parallel!');
````

### Performance Comparison

```typescript
import { go, goAll } from 'gonex';

// Event-loop execution (single-threaded)
const eventLoopResults = await goAll(tasks, [], { useWorkerThreads: false });
// Execution time: ~16 seconds

// Worker thread execution (multi-core)
const parallelResults = await goAll(tasks, [] { useWorkerThreads: true });
// Execution time: ~6 seconds (2.6x faster!)
```

## Architecture

This package is built with enterprise-level architecture principles:

- **Zero Dependencies** - Pure TypeScript implementation
- **Type Safety** - Full TypeScript support with generics
- **True Parallelism** - Multi-core execution with Worker Threads
- **Performance Optimized** - Minimal overhead, maximum speed
- **Memory Efficient** - Proper resource management
- **Extensible** - Plugin architecture for custom patterns
- **Testable** - Comprehensive test coverage
- **Documented** - Full API documentation with examples

## 🚀 Development & Releases

This project uses automated CI/CD with GitHub Actions:

- **CI/CD:** Automated testing, linting, and building on every push
- **Releases:** Manual release workflow for controlled versioning
- **Quality:** Comprehensive test coverage and TypeScript strict mode
- **Documentation:** Auto-generated API docs

### Contributing

1. Fork the repository
2. Create a feature branch from `develop`
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request to `develop`

### Release Process

Releases are managed through GitHub Actions:

1. Merge `develop` to `master`
2. Go to Actions → Manual Release
3. Choose version type (patch/minor/major)
4. Automatic npm publish and GitHub release

## 📄 License

MIT License - see LICENSE file for details.
