# Folder Structure Documentation

## Overview

This document describes the enterprise-level folder structure for the GoLang-inspired concurrency package for Node.js. The structure is designed for extensibility, maintainability, and scalability.

## Root Directory Structure

```
gonex/
├── src/                    # Source code directory
├── dist/                   # Compiled JavaScript output (generated)
├── docs/                   # Generated documentation
├── examples/               # Usage examples and demos
├── benchmarks/             # Performance benchmarks
├── coverage/               # Test coverage reports (generated)
├── node_modules/           # Dependencies (generated)
├── package.json            # Package configuration
├── tsconfig.json           # TypeScript configuration
├── jest.config.js          # Jest testing configuration
├── .eslintrc.js            # ESLint configuration
├── .prettierrc             # Prettier configuration
├── .gitignore              # Git ignore rules
├── README.md               # Main documentation
└── FOLDER_STRUCTURE.md     # This file
```

## Source Code Structure (`src/`)

### Core Concurrency Primitives (`src/core/`)

Contains the fundamental concurrency primitives inspired by Go:

- **`goroutine.ts`** - Lightweight concurrent function execution
- **`channel.ts`** - Typed communication between goroutines
- **`select.ts`** - Non-blocking channel operations
- **`waitgroup.ts`** - Synchronization for multiple goroutines
- **`mutex.ts`** - Mutual exclusion locks
- **`rwmutex.ts`** - Read-write mutex
- **`once.ts`** - One-time initialization
- **`cond.ts`** - Condition variables
- **`semaphore.ts`** - Resource limiting
- **`context.ts`** - Cancellation and deadlines

### Timing and Scheduling (`src/timing/`)

Contains timing-related functionality:

- **`ticker.ts`** - Periodic events
- **`timer.ts`** - One-time delayed events
- **`sleep.ts`** - Cooperative yielding

### Advanced Patterns (`src/patterns/`)

Contains higher-level concurrency patterns:

- **`worker-pool.ts`** - Managed goroutine pools
- **`pipeline.ts`** - Chained processing
- **`fan-patterns.ts`** - Fan-out/Fan-in patterns
- **`rate-limiter.ts`** - Request throttling
- **`circuit-breaker.ts`** - Fault tolerance
- **`retry.ts`** - Automatic retry mechanisms

### Utilities (`src/utils/`)

Contains shared utilities and helpers:

- **`errors.ts`** - Custom error types
- **`validators.ts`** - Input validation utilities
- **`decorators.ts`** - TypeScript decorators
- **`constants.ts`** - Package constants
- **`helpers.ts`** - General helper functions

### Types (`src/types/`)

Contains TypeScript type definitions:

- **`index.ts`** - All exported types and interfaces
- **`channel.ts`** - Channel-related types
- **`context.ts`** - Context-related types
- **`patterns.ts`** - Pattern-related types

### Main Entry Point (`src/index.ts`)

The main entry point that exports all public APIs.

## Testing Structure (`src/__tests__/`)

### Core Tests (`src/__tests__/core/`)

Unit tests for core concurrency primitives:

- **`goroutine.test.ts`**
- **`channel.test.ts`**
- **`select.test.ts`**
- **`waitgroup.test.ts`**
- **`mutex.test.ts`**
- **`rwmutex.test.ts`**
- **`once.test.ts`**
- **`cond.test.ts`**
- **`semaphore.test.ts`**
- **`context.test.ts`**

### Timing Tests (`src/__tests__/timing/`)

Unit tests for timing functionality:

- **`ticker.test.ts`**
- **`timer.test.ts`**
- **`sleep.test.ts`**

### Pattern Tests (`src/__tests__/patterns/`)

Unit tests for advanced patterns:

- **`worker-pool.test.ts`**
- **`pipeline.test.ts`**
- **`fan-patterns.test.ts`**
- **`rate-limiter.test.ts`**
- **`circuit-breaker.test.ts`**
- **`retry.test.ts`**

### Utility Tests (`src/__tests__/utils/`)

Unit tests for utilities:

- **`errors.test.ts`**
- **`validators.test.ts`**
- **`helpers.test.ts`**

### Test Setup (`src/__tests__/setup.ts`)

Global test configuration and setup.

## Examples Directory (`examples/`)

### Basic Examples

- **`basic-goroutines/`** - Simple goroutine usage
- **`channel-communication/`** - Channel examples
- **`waitgroup-sync/`** - WaitGroup synchronization
- **`mutex-locks/`** - Mutex usage examples

### Advanced Examples

- **`worker-pool/`** - Worker pool implementation
- **`pipeline-processing/`** - Pipeline patterns
- **`rate-limiting/`** - Rate limiter usage
- **`circuit-breaker/`** - Circuit breaker patterns
- **`retry-mechanisms/`** - Retry pattern examples

### Real-world Examples

- **`web-server/`** - HTTP server with concurrency
- **`data-processing/`** - Data processing pipelines
- **`api-client/`** - API client with retry and rate limiting

## Benchmarks Directory (`benchmarks/`)

### Performance Tests

- **`goroutine-performance.ts`** - Goroutine overhead
- **`channel-performance.ts`** - Channel throughput
- **`mutex-performance.ts`** - Lock performance
- **`worker-pool-performance.ts`** - Pool efficiency

### Comparison Tests

- **`vs-native-promises.ts`** - Comparison with native promises
- **`vs-async-await.ts`** - Comparison with async/await
- **`vs-worker-threads.ts`** - Comparison with worker threads

## Documentation Directory (`docs/`)

### Generated Documentation

- **`api/`** - Auto-generated API documentation
- **`examples/`** - Example documentation
- **`guides/`** - Usage guides and tutorials

## Build Output (`dist/`)

### Compiled Files

- **`index.js`** - Main entry point
- **`index.d.ts`** - TypeScript declarations
- **`core/`** - Compiled core modules
- **`timing/`** - Compiled timing modules
- **`patterns/`** - Compiled pattern modules
- **`utils/`** - Compiled utility modules

## Design Principles

### 1. Separation of Concerns

- Core primitives are isolated in their own modules
- Advanced patterns build upon core primitives
- Utilities are shared across all modules

### 2. Extensibility

- Plugin architecture for custom patterns
- Modular design allows easy addition of new features
- Clear interfaces for extension points

### 3. Testability

- Each module has corresponding test files
- Comprehensive test coverage
- Isolated unit tests with minimal dependencies

### 4. Documentation

- Inline code documentation
- Generated API documentation
- Comprehensive examples
- Usage guides and tutorials

### 5. Performance

- Optimized for Node.js event loop
- Memory-efficient implementations
- Performance benchmarks included

### 6. Type Safety

- Full TypeScript support
- Generic types for flexibility
- Strict type checking

## File Naming Conventions

### Source Files

- Use kebab-case for file names: `worker-pool.ts`
- Use PascalCase for class names: `WorkerPool`
- Use camelCase for function names: `createWorkerPool`

### Test Files

- Match source file names with `.test.ts` suffix
- Use descriptive test names
- Group related tests in describe blocks

### Example Files

- Use descriptive names: `basic-goroutines.ts`
- Include README files for each example
- Provide both simple and complex examples

## Module Dependencies

### Core Dependencies

```
src/core/goroutine.ts     → No dependencies
src/core/channel.ts       → No dependencies
src/core/select.ts        → src/core/channel.ts
src/core/waitgroup.ts     → No dependencies
src/core/mutex.ts         → No dependencies
src/core/rwmutex.ts       → src/core/mutex.ts
src/core/once.ts          → No dependencies
src/core/cond.ts          → src/core/mutex.ts
src/core/semaphore.ts     → No dependencies
src/core/context.ts       → No dependencies
```

### Pattern Dependencies

```
src/patterns/worker-pool.ts    → src/core/goroutine.ts, src/core/channel.ts
src/patterns/pipeline.ts       → src/core/channel.ts, src/core/select.ts
src/patterns/fan-patterns.ts   → src/core/channel.ts, src/core/select.ts
src/patterns/rate-limiter.ts   → src/core/semaphore.ts, src/timing/timer.ts
src/patterns/circuit-breaker.ts → src/core/context.ts
src/patterns/retry.ts          → src/core/context.ts, src/timing/sleep.ts
```

### Timing Dependencies

```
src/timing/ticker.ts      → src/core/channel.ts, src/core/context.ts
src/timing/timer.ts       → src/core/channel.ts, src/core/context.ts
src/timing/sleep.ts       → No dependencies
```

This structure ensures a clean dependency graph and makes the package easy to understand, maintain, and extend.
