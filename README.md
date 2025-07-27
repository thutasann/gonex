# GoLang Inspired Concurrency Package for Node.js

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

## License

MIT License - see LICENSE file for details.