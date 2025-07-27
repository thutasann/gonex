# Phase 2: Core Concurrency Primitives Implementation Plan

## Overview

Phase 2 implements the fundamental concurrency primitives that form the backbone of the package. These primitives provide the basic building blocks for concurrent programming, inspired by Go's concurrency model.

## Implementation Order

1. **`src/core/goroutine.ts`** - Lightweight concurrent function execution
2. **`src/core/channel.ts`** - Typed communication between goroutines
3. **`src/core/waitgroup.ts`** - Synchronization for multiple goroutines
4. **`src/core/mutex.ts`** - Mutual exclusion locks
5. **`src/core/semaphore.ts`** - Resource limiting and access control
6. **`src/core/once.ts`** - One-time initialization guarantees

---

## 1. Goroutine Implementation (`src/core/goroutine.ts`)

### Purpose

Provide lightweight concurrent function execution similar to Go's goroutines, but adapted for Node.js's event loop model.

### Key Features

- **Non-blocking execution** - Functions run asynchronously without blocking the main thread
- **Error handling** - Proper error propagation and handling
- **Resource management** - Automatic cleanup and memory management
- **Performance optimization** - Efficient scheduling using Node.js event loop

### Implementation Details

```typescript
interface GoroutineOptions {
  name?: string;
  timeout?: number;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

function go<T>(
  fn: () => T | Promise<T>,
  options?: GoroutineOptions
): Promise<T>;
```

### Core Functionality

1. **Function Execution**
   - Execute the provided function asynchronously
   - Handle both synchronous and asynchronous functions
   - Return a Promise that resolves with the function result

2. **Error Handling**
   - Catch and properly propagate errors
   - Support custom error handlers
   - Maintain stack traces for debugging

3. **Resource Management**
   - Automatic cleanup of resources
   - Memory leak prevention
   - Proper event listener cleanup

4. **Performance Optimization**
   - Use `setImmediate` for immediate execution
   - Cooperative yielding for long-running operations
   - Efficient Promise handling

### Usage Examples

```typescript
// Basic goroutine
const result = await go(() => {
  return 'Hello from goroutine!';
});

// Goroutine with error handling
const result = await go(
  async () => {
    throw new Error('Something went wrong');
  },
  {
    onError: error => console.error('Goroutine error:', error),
  }
);

// Goroutine with timeout
const result = await go(
  async () => {
    await sleep(10000); // Long operation
    return 'Done';
  },
  { timeout: 5000 }
);
```

---

## 2. Channel Implementation (`src/core/channel.ts`)

### Purpose

Provide typed communication between goroutines, supporting both buffered and unbuffered channels with blocking and non-blocking operations.

### Key Features

- **Type safety** - Generic channels with compile-time type checking
- **Buffered and unbuffered** - Support for both channel types
- **Blocking operations** - Send/receive with proper blocking semantics
- **Non-blocking operations** - TrySend/TryReceive for non-blocking access
- **Channel closing** - Proper cleanup and closed channel handling
- **Select support** - Integration with select statement (Phase 3)

### Implementation Details

```typescript
interface ChannelOptions<T> {
  bufferSize?: number;
  timeout?: number;
  name?: string;
}

class Channel<T> {
  constructor(options?: ChannelOptions<T>);

  send(value: T): Promise<void>;
  receive(): Promise<T>;
  trySend(value: T): boolean;
  tryReceive(): T | undefined;
  close(): void;
  isClosed(): boolean;
  length(): number;
  capacity(): number;
}
```

### Core Functionality

1. **Channel Creation**
   - Support for buffered and unbuffered channels
   - Configurable buffer size and timeout
   - Optional channel naming for debugging

2. **Send Operations**
   - `send()` - Blocking send operation
   - `trySend()` - Non-blocking send operation
   - Proper handling of closed channels
   - Timeout support for send operations

3. **Receive Operations**
   - `receive()` - Blocking receive operation
   - `tryReceive()` - Non-blocking receive operation
   - Proper handling of closed channels
   - Timeout support for receive operations

4. **Channel Management**
   - `close()` - Close the channel
   - `isClosed()` - Check if channel is closed
   - `length()` - Get current buffer length
   - `capacity()` - Get channel capacity

### Usage Examples

```typescript
// Unbuffered channel
const ch = channel<string>();

// Buffered channel
const bufferedCh = channel<number>({ bufferSize: 10 });

// Send and receive
go(async () => {
  await ch.send('Hello');
});

go(async () => {
  const msg = await ch.receive();
  console.log(msg); // "Hello"
});

// Non-blocking operations
const sent = ch.trySend('Quick message');
const received = ch.tryReceive();
```

---

## 3. WaitGroup Implementation (`src/core/waitgroup.ts`)

### Purpose

Provide synchronization for multiple goroutines, allowing the main thread to wait for all goroutines to complete.

### Key Features

- **Counter management** - Add/done operations with proper validation
- **Wait functionality** - Block until counter reaches zero
- **Error handling** - Proper error propagation from goroutines
- **Timeout support** - Optional timeout for wait operations

### Implementation Details

```typescript
interface WaitGroupOptions {
  timeout?: number;
  name?: string;
}

class WaitGroup {
  constructor(options?: WaitGroupOptions);

  add(delta: number): void;
  done(): void;
  wait(): Promise<void>;
  count(): number;
}
```

### Core Functionality

1. **Counter Management**
   - `add(delta)` - Add to the counter
   - `done()` - Decrement the counter
   - `count()` - Get current counter value
   - Proper validation to prevent negative counters

2. **Wait Operations**
   - `wait()` - Block until counter reaches zero
   - Support for timeout
   - Proper error handling

3. **Error Handling**
   - Collect errors from goroutines
   - Aggregate multiple errors
   - Provide error context

### Usage Examples

```typescript
const wg = waitGroup();

for (let i = 0; i < 3; i++) {
  wg.add(1);
  go(async () => {
    try {
      await sleep(1000);
      console.log(`Worker ${i} completed`);
    } finally {
      wg.done();
    }
  });
}

await wg.wait();
console.log('All workers completed');
```

---

## 4. Mutex Implementation (`src/core/mutex.ts`)

### Purpose

Provide mutual exclusion locks for protecting shared resources in concurrent environments.

### Key Features

- **Exclusive locking** - Only one goroutine can hold the lock at a time
- **Timeout support** - Configurable timeout for lock acquisition
- **Error handling** - Proper error propagation
- **Resource cleanup** - Automatic lock release on errors

### Implementation Details

```typescript
interface MutexOptions {
  timeout?: number;
  name?: string;
}

class Mutex {
  constructor(options?: MutexOptions);

  lock(): Promise<void>;
  unlock(): void;
  tryLock(): boolean;
  isLocked(): boolean;
}
```

### Core Functionality

1. **Lock Operations**
   - `lock()` - Acquire the lock (blocking)
   - `tryLock()` - Try to acquire the lock (non-blocking)
   - `unlock()` - Release the lock
   - `isLocked()` - Check if lock is held

2. **Timeout Support**
   - Configurable timeout for lock acquisition
   - Proper error handling for timeouts

3. **Resource Protection**
   - Automatic lock release on errors
   - Proper cleanup in all scenarios

### Usage Examples

```typescript
const mutex = new Mutex();
let sharedResource = 0;

go(async () => {
  await mutex.lock();
  try {
    sharedResource++;
    await sleep(1000);
  } finally {
    mutex.unlock();
  }
});

// Using tryLock
if (mutex.tryLock()) {
  try {
    sharedResource++;
  } finally {
    mutex.unlock();
  }
}
```

---

## 5. Semaphore Implementation (`src/core/semaphore.ts`)

### Purpose

Provide resource limiting and access control, allowing a limited number of goroutines to access a resource simultaneously.

### Key Features

- **Resource limiting** - Control concurrent access to resources
- **Acquire/release** - Proper resource management
- **Timeout support** - Configurable timeout for acquisition
- **Error handling** - Proper error propagation

### Implementation Details

```typescript
interface SemaphoreOptions {
  permits: number;
  timeout?: number;
  name?: string;
}

class Semaphore {
  constructor(options: SemaphoreOptions);

  acquire(): Promise<void>;
  release(): void;
  tryAcquire(): boolean;
  availablePermits(): number;
}
```

### Core Functionality

1. **Resource Management**
   - `acquire()` - Acquire a permit (blocking)
   - `release()` - Release a permit
   - `tryAcquire()` - Try to acquire a permit (non-blocking)
   - `availablePermits()` - Get number of available permits

2. **Concurrency Control**
   - Limit concurrent access to resources
   - Proper permit management
   - Support for timeout

### Usage Examples

```typescript
const semaphore = new Semaphore({ permits: 3 });

for (let i = 0; i < 10; i++) {
  go(async () => {
    await semaphore.acquire();
    try {
      console.log(`Processing task ${i}`);
      await sleep(1000);
    } finally {
      semaphore.release();
    }
  });
}
```

---

## 6. Once Implementation (`src/core/once.ts`)

### Purpose

Provide one-time initialization guarantees, ensuring that initialization code runs exactly once regardless of concurrent access.

### Key Features

- **One-time execution** - Initialization runs exactly once
- **Thread safety** - Safe for concurrent access
- **Error handling** - Proper error propagation
- **Performance** - Efficient implementation

### Implementation Details

```typescript
interface OnceOptions {
  name?: string;
}

class Once {
  constructor(options?: OnceOptions);

  do(fn: () => void | Promise<void>): Promise<void>;
  isDone(): boolean;
}
```

### Core Functionality

1. **One-time Execution**
   - `do(fn)` - Execute function exactly once
   - `isDone()` - Check if initialization is complete
   - Proper synchronization for concurrent access

2. **Error Handling**
   - Proper error propagation
   - Consistent behavior on errors

### Usage Examples

```typescript
const once = new Once();

// Multiple goroutines trying to initialize
for (let i = 0; i < 5; i++) {
  go(async () => {
    await once.do(async () => {
      console.log('Initializing...');
      await sleep(1000);
      console.log('Initialized!');
    });
  });
}
```

---

## Testing Strategy

### Goroutine Testing (`src/__tests__/core/goroutine.test.ts`)

- Test basic goroutine execution
- Test error handling and propagation
- Test timeout functionality
- Test resource cleanup
- Test concurrent execution

### Channel Testing (`src/__tests__/core/channel.test.ts`)

- Test buffered and unbuffered channels
- Test send/receive operations
- Test channel closing
- Test timeout functionality
- Test concurrent access

### WaitGroup Testing (`src/__tests__/core/waitgroup.test.ts`)

- Test counter management
- Test wait functionality
- Test error aggregation
- Test timeout functionality

### Mutex Testing (`src/__tests__/core/mutex.test.ts`)

- Test lock/unlock operations
- Test timeout functionality
- Test concurrent access
- Test resource cleanup

### Semaphore Testing (`src/__tests__/core/semaphore.test.ts`)

- Test acquire/release operations
- Test resource limiting
- Test timeout functionality
- Test concurrent access

### Once Testing (`src/__tests__/core/once.test.ts`)

- Test one-time execution
- Test concurrent access
- Test error handling

---

## Implementation Checklist

### Phase 2.1: Goroutine

- [ ] Implement basic goroutine function
- [ ] Add error handling and propagation
- [ ] Add timeout support
- [ ] Add resource cleanup
- [ ] Write comprehensive tests

### Phase 2.2: Channel

- [ ] Implement Channel class
- [ ] Add buffered and unbuffered support
- [ ] Implement send/receive operations
- [ ] Add channel closing functionality
- [ ] Add timeout support
- [ ] Write comprehensive tests

### Phase 2.3: WaitGroup

- [ ] Implement WaitGroup class
- [ ] Add counter management
- [ ] Implement wait functionality
- [ ] Add error aggregation
- [ ] Write comprehensive tests

### Phase 2.4: Mutex

- [ ] Implement Mutex class
- [ ] Add lock/unlock operations
- [ ] Add timeout support
- [ ] Add resource cleanup
- [ ] Write comprehensive tests

### Phase 2.5: Semaphore

- [ ] Implement Semaphore class
- [ ] Add acquire/release operations
- [ ] Add resource limiting
- [ ] Add timeout support
- [ ] Write comprehensive tests

### Phase 2.6: Once

- [ ] Implement Once class
- [ ] Add one-time execution
- [ ] Add concurrent access safety
- [ ] Write comprehensive tests

---

## Dependencies

- **Phase 1 utilities** - Error handling, validation, constants, helpers
- **Node.js built-ins** - Promise, setTimeout, setImmediate

## Performance Considerations

- Minimize Promise creation overhead
- Use efficient data structures for channels
- Optimize lock contention in mutex
- Efficient permit management in semaphore
- Minimal overhead for once execution

## Next Steps

After completing Phase 2, we'll have the core concurrency primitives implemented. The next phase will focus on advanced patterns and timing utilities.

**Phase 3 will include:**

- `src/core/select.ts` - Non-blocking channel operations
- `src/timing/timer.ts` - One-time delayed events
- `src/timing/ticker.ts` - Periodic events
- `src/timing/sleep.ts` - Cooperative yielding
- `src/core/context.ts` - Cancellation and deadlines
