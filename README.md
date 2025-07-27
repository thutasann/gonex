# Minimal, fast, and Go-inspired concurrency model for Node.js

A comprehensive TypeScript library that brings Go's powerful concurrency primitives to Node.js, enabling robust, scalable concurrent programming patterns.

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

```typescript
import { go, channel, select, waitGroup } from 'gonex';

// Simple goroutine
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
```

## Architecture

This package is built with enterprise-level architecture principles:

- **Zero Dependencies** - Pure TypeScript implementation
- **Type Safety** - Full TypeScript support with generics
- **Performance** - Optimized for Node.js event loop
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
