# Phase 1: Foundation Implementation Plan

## Overview

Phase 1 establishes the foundational utilities that all other components will depend on. These utilities provide error handling, constants, validation, and helper functions that are essential for the entire package.

## Implementation Order

1. **`src/utils/errors.ts`** - Custom error types
2. **`src/utils/constants.ts`** - Package constants
3. **`src/utils/validators.ts`** - Input validation utilities
4. **`src/utils/helpers.ts`** - General helper functions

---

## 1. Custom Error Types (`src/utils/errors.ts`)

### Purpose

Define a comprehensive set of custom error types that provide meaningful error messages and proper error handling throughout the package.

### Error Hierarchy

```
GonexError (base class)
├── ChannelError
│   ├── ChannelClosedError
│   ├── ChannelTimeoutError
│   └── ChannelBufferFullError
├── ContextError
│   ├── ContextCancelledError
│   ├── ContextTimeoutError
│   └── ContextDeadlineExceededError
├── MutexError
│   ├── MutexLockTimeoutError
│   └── MutexAlreadyLockedError
├── WaitGroupError
│   └── WaitGroupNegativeCounterError
├── SemaphoreError
│   └── SemaphoreTimeoutError
└── ValidationError
    ├── InvalidTimeoutError
    ├── InvalidBufferSizeError
    └── InvalidConcurrencyError
```

### Implementation Details

- **Base Error Class**: `GonexError` extends `Error` with additional properties
- **Error Codes**: Each error has a unique error code for programmatic handling
- **Context Information**: Errors include relevant context (channel name, timeout values, etc.)
- **Stack Traces**: Proper stack trace preservation
- **Serialization**: Errors can be serialized for logging/debugging

### Key Methods

```typescript
class GonexError extends Error {
  code: string;
  context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>);
  toJSON(): object;
}
```

---

## 2. Package Constants (`src/utils/constants.ts`)

### Purpose

Define all default values, limits, and configuration constants used throughout the package.

### Constant Categories

#### Timeouts

```typescript
DEFAULT_TIMEOUT = 5000; // 5 seconds
DEFAULT_CHANNEL_TIMEOUT = 1000; // 1 second
DEFAULT_MUTEX_TIMEOUT = 3000; // 3 seconds
DEFAULT_SEMAPHORE_TIMEOUT = 2000; // 2 seconds
INFINITE_TIMEOUT = -1; // No timeout
MAX_TIMEOUT = 86400000; // 24 hours
```

#### Buffer Sizes

```typescript
DEFAULT_CHANNEL_BUFFER = 0; // Unbuffered by default
MAX_CHANNEL_BUFFER = 1000000; // 1 million items
DEFAULT_WORKER_POOL_SIZE = 10; // Default pool size
MAX_WORKER_POOL_SIZE = 10000; // Maximum pool size
```

#### Retry Configuration

```typescript
DEFAULT_MAX_RETRIES = 3;
DEFAULT_RETRY_DELAY = 1000; // 1 second
MAX_RETRY_DELAY = 30000; // 30 seconds
DEFAULT_BACKOFF_FACTOR = 2; // Exponential backoff
```

#### Rate Limiting

```typescript
DEFAULT_RATE_LIMIT = 100; // 100 requests
DEFAULT_TIME_WINDOW = 60000; // 1 minute
DEFAULT_BURST_SIZE = 10; // Burst allowance
```

#### Circuit Breaker

```typescript
DEFAULT_FAILURE_THRESHOLD = 5;
DEFAULT_RECOVERY_TIMEOUT = 60000; // 1 minute
DEFAULT_HALF_OPEN_LIMIT = 3; // Test requests
```

---

## 3. Input Validation (`src/utils/validators.ts`)

### Purpose

Provide comprehensive input validation utilities to ensure all function parameters are valid before processing.

### Validation Functions

#### Time Validation

```typescript
validateTimeout(timeout: number, name?: string): void
validateDeadline(deadline: Date, name?: string): void
validateDuration(duration: number, name?: string): void
```

#### Buffer and Size Validation

```typescript
validateBufferSize(size: number, name?: string): void
validateConcurrencyLevel(level: number, name?: string): void
validatePoolSize(size: number, name?: string): void
```

#### Channel Validation

```typescript
validateChannelOptions(options: ChannelOptions): void
validateChannelOperation(operation: 'send' | 'receive'): void
```

#### Context Validation

```typescript
validateContextOptions(options: ContextOptions): void
validateContextValues(values: Record<string, any>): void
```

#### Pattern Validation

```typescript
validateWorkerPoolOptions(options: WorkerPoolOptions): void
validateRateLimiterOptions(options: RateLimiterOptions): void
validateCircuitBreakerOptions(options: CircuitBreakerOptions): void
validateRetryOptions(options: RetryOptions): void
```

### Validation Rules

#### Timeout Values

- Must be a positive number or -1 (infinite)
- Maximum allowed: 24 hours (86400000ms)
- Minimum allowed: 0ms

#### Buffer Sizes

- Must be a non-negative integer
- Maximum allowed: 1,000,000 items
- Must be finite (not Infinity)

#### Concurrency Levels

- Must be a positive integer
- Maximum allowed: 10,000 concurrent operations
- Must be finite

#### Error Messages

- Clear, descriptive error messages
- Include parameter name and value
- Suggest valid ranges where applicable

---

## 4. Helper Functions (`src/utils/helpers.ts`)

### Purpose

Provide general utility functions that are used across multiple components.

### Core Helper Functions

#### Sleep Function

```typescript
sleep(duration: number): Promise<void>
```

- Cooperative yielding for specified duration
- Uses `setTimeout` with Promise wrapper
- Throws `InvalidTimeoutError` for invalid durations

#### Promise Utilities

```typescript
createTimeoutPromise<T>(promise: Promise<T>, timeout: number): Promise<T>
createCancellablePromise<T>(promise: Promise<T>, signal: AbortSignal): Promise<T>
```

#### Type Guards

```typescript
isPromise(value: any): value is Promise<any>
isAsyncFunction(value: any): value is Function
isValidTimeout(timeout: any): timeout is number
isValidBufferSize(size: any): size is number
```

#### Object Utilities

```typescript
deepClone<T>(obj: T): T
mergeOptions<T>(defaults: T, options: Partial<T>): T
pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>
```

#### Event Loop Utilities

```typescript
nextTick(): Promise<void>
setImmediate(): Promise<void>
yield(): Promise<void>
```

---

## Testing Strategy

### Error Testing (`src/__tests__/utils/errors.test.ts`)

- Test all error types and their properties
- Verify error codes and messages
- Test error inheritance hierarchy
- Test error serialization

### Constants Testing (`src/__tests__/utils/constants.test.ts`)

- Verify all constants are properly defined
- Test constant relationships (e.g., max > default)
- Ensure constants are immutable

### Validation Testing (`src/__tests__/utils/validators.test.ts`)

- Test all validation functions with valid inputs
- Test validation functions with invalid inputs
- Verify error messages are descriptive
- Test edge cases and boundary conditions

### Helper Testing (`src/__tests__/utils/helpers.test.ts`)

- Test sleep function accuracy
- Test promise utilities
- Test type guards
- Test object utilities
- Test event loop utilities

---

## Implementation Checklist

### Phase 1.1: Error System

- [ ] Create `GonexError` base class
- [ ] Implement `ChannelError` and subclasses
- [ ] Implement `ContextError` and subclasses
- [ ] Implement `MutexError` and subclasses
- [ ] Implement `WaitGroupError` and subclasses
- [ ] Implement `SemaphoreError` and subclasses
- [ ] Implement `ValidationError` and subclasses
- [ ] Add error serialization methods
- [ ] Write comprehensive tests

### Phase 1.2: Constants

- [ ] Define timeout constants
- [ ] Define buffer size constants
- [ ] Define retry configuration constants
- [ ] Define rate limiting constants
- [ ] Define circuit breaker constants
- [ ] Add JSDoc comments for all constants
- [ ] Write tests for constant relationships

### Phase 1.3: Validation

- [ ] Implement time validation functions
- [ ] Implement buffer and size validation functions
- [ ] Implement channel validation functions
- [ ] Implement context validation functions
- [ ] Implement pattern validation functions
- [ ] Add comprehensive error messages
- [ ] Write tests for all validation scenarios

### Phase 1.4: Helpers

- [ ] Implement sleep function
- [ ] Implement promise utilities
- [ ] Implement type guards
- [ ] Implement object utilities
- [ ] Implement event loop utilities
- [ ] Add performance optimizations
- [ ] Write comprehensive tests

---

## Dependencies

- **No external dependencies** - Pure TypeScript implementation
- **Node.js built-ins only** - `setTimeout`, `setImmediate`, `Promise`

## Performance Considerations

- Minimize object creation in error constructors
- Use early return on validation failures
- Optimize sleep function for Node.js event loop
- Use efficient object cloning for small objects
- Minimize Promise creation overhead

## Next Steps

After completing Phase 1, we'll have a solid foundation to build upon. The next phase will focus on the core concurrency primitives that depend on these utilities.

**Phase 2 will include:**

- `src/core/goroutine.ts` - Using helpers and error handling
- `src/core/channel.ts` - Using validation and constants
- `src/core/waitgroup.ts` - Using error handling
- `src/core/mutex.ts` - Using validation and timeouts
- `src/core/semaphore.ts` - Using validation and timeouts
- `src/core/once.ts` - Using error handling
