# Phase 3: Advanced Patterns and Timing Utilities Implementation Plan

## Overview

Phase 3 implements advanced concurrency patterns and timing utilities that build upon the core primitives. These components provide higher-level abstractions for common concurrent programming scenarios and precise timing control.

## Implementation Order

1. **`src/core/select.ts`** - Non-blocking channel operations with multiple cases
2. **`src/timing/timer.ts`** - One-time delayed events
3. **`src/timing/ticker.ts`** - Periodic events
4. **`src/timing/sleep.ts`** - Cooperative yielding and delays
5. **`src/core/context.ts`** - Cancellation and deadlines

---

## 1. Select Implementation (`src/core/select.ts`)

### Purpose

Provide non-blocking channel operations with multiple cases, similar to Go's select statement. This allows goroutines to wait on multiple channels simultaneously and respond to the first available operation.

### Key Features

- **Multiple channel cases** - Wait on multiple send/receive operations
- **Non-blocking operations** - TrySend/TryReceive for immediate results
- **Default case** - Execute when no channels are ready
- **Timeout support** - Overall timeout for the entire select operation
- **Performance optimization** - Efficient polling and event handling

### Implementation Details

```typescript
type SelectCase<T> = {
  channel: Channel<T>;
  operation: 'send' | 'receive';
  value?: T; // Required for send operations
  handler?: (value: T) => void;
};

type SelectOptions = {
  timeout?: number;
  default?: () => void;
};

function select<T>(cases: SelectCase<T>[], options?: SelectOptions): Promise<T>;
```

### Core Functionality

1. **Case Management**
   - Support for multiple send/receive cases
   - Optional handlers for each case
   - Default case when no channels are ready

2. **Operation Types**
   - `send` - Send value to channel
   - `receive` - Receive value from channel
   - Non-blocking try operations for immediate results

3. **Timeout Support**
   - Overall timeout for the entire select operation
   - Proper cleanup on timeout

### Usage Examples

```typescript
// Basic select with multiple channels
const result = await select([
  { channel: ch1, operation: 'receive' },
  { channel: ch2, operation: 'send', value: 'hello' },
  { channel: ch3, operation: 'receive' },
]);

// Select with handlers
const result = await select([
  {
    channel: ch1,
    operation: 'receive',
    handler: value => console.log('Received from ch1:', value),
  },
  {
    channel: ch2,
    operation: 'send',
    value: 'hello',
    handler: () => console.log('Sent to ch2'),
  },
]);

// Select with timeout and default
const result = await select(
  [
    { channel: ch1, operation: 'receive' },
    { channel: ch2, operation: 'receive' },
  ],
  {
    timeout: 5000,
    default: () => console.log('No channels ready'),
  }
);
```

---

## 2. Timer Implementation (`src/timing/timer.ts`)

### Purpose

Provide one-time delayed events with precise timing control. This is useful for implementing timeouts, delays, and scheduled operations.

### Key Features

- **One-time execution** - Timer fires exactly once
- **Precise timing** - Accurate delay implementation
- **Cancellation support** - Stop timer before it fires
- **Reset capability** - Restart timer with new duration
- **Performance optimization** - Efficient timer management

### Implementation Details

```typescript
type TimerOptions = {
  duration: number;
  name?: string;
};

class Timer {
  constructor(options: TimerOptions);

  start(): Promise<void>;
  stop(): void;
  reset(duration?: number): void;
  isRunning(): boolean;
  remainingTime(): number;
}
```

### Core Functionality

1. **Timer Management**
   - Start timer with specified duration
   - Stop timer before completion
   - Reset timer with new duration
   - Check timer status

2. **Timing Control**
   - Precise delay implementation
   - Remaining time calculation
   - Cancellation support

### Usage Examples

```typescript
// Basic timer
const timer = new Timer({ duration: 5000 });
await timer.start(); // Waits 5 seconds

// Timer with cancellation
const timer = new Timer({ duration: 10000 });
const promise = timer.start();
setTimeout(() => timer.stop(), 2000); // Cancel after 2 seconds

// Timer with reset
const timer = new Timer({ duration: 5000 });
timer.start();
setTimeout(() => timer.reset(3000), 2000); // Reset to 3 seconds
```

---

## 3. Ticker Implementation (`src/timing/ticker.ts`)

### Purpose

Provide periodic events with configurable intervals. This is useful for implementing heartbeats, polling, and recurring operations.

### Key Features

- **Periodic execution** - Ticker fires at regular intervals
- **Configurable interval** - Set custom time between events
- **Cancellation support** - Stop ticker at any time
- **Channel integration** - Send events through channels
- **Performance optimization** - Efficient interval management

### Implementation Details

```typescript
type TickerOptions = {
  interval: number;
  name?: string;
};

class Ticker {
  constructor(options: TickerOptions);

  start(): Channel<number>;
  stop(): void;
  isRunning(): boolean;
  getInterval(): number;
  setInterval(interval: number): void;
}
```

### Core Functionality

1. **Ticker Management**
   - Start ticker with specified interval
   - Stop ticker at any time
   - Configure interval dynamically
   - Check ticker status

2. **Event Generation**
   - Generate events at regular intervals
   - Send events through channels
   - Maintain accurate timing

### Usage Examples

```typescript
// Basic ticker
const ticker = new Ticker({ interval: 1000 });
const channel = ticker.start();

go(async () => {
  for await (const tick of channel) {
    console.log('Tick:', tick);
  }
});

// Ticker with dynamic interval
const ticker = new Ticker({ interval: 1000 });
const channel = ticker.start();

setTimeout(() => ticker.setInterval(500), 5000); // Change to 500ms
setTimeout(() => ticker.stop(), 10000); // Stop after 10 seconds
```

---

## 4. Sleep Implementation (`src/timing/sleep.ts`)

### Purpose

Provide cooperative yielding and precise delays. This is essential for implementing timeouts, rate limiting, and cooperative multitasking.

### Key Features

- **Precise timing** - Accurate delay implementation
- **Cooperative yielding** - Allow other goroutines to run
- **Performance optimization** - Efficient sleep implementation
- **Integration with other primitives** - Work with channels, timers, etc.

### Implementation Details

```typescript
function sleep(duration: number): Promise<void>;
function sleepUntil(deadline: Date): Promise<void>;
function sleepFor(duration: number): Promise<void>;
```

### Core Functionality

1. **Sleep Operations**
   - Sleep for specified duration
   - Sleep until specific deadline
   - Cooperative yielding

2. **Timing Control**
   - Precise delay implementation
   - Integration with event loop
   - Performance optimization

### Usage Examples

```typescript
// Basic sleep
await sleep(1000); // Sleep for 1 second

// Sleep until deadline
const deadline = new Date(Date.now() + 5000);
await sleepUntil(deadline);

// Sleep with rate limiting
for (let i = 0; i < 10; i++) {
  await sleep(100); // Rate limit to 10 per second
  console.log('Operation:', i);
}
```

---

## 5. Context Implementation (`src/core/context.ts`)

### Purpose

Provide cancellation, deadlines, and request-scoped values. This is essential for implementing timeouts, cancellation propagation, and request context management.

### Key Features

- **Cancellation support** - Propagate cancellation signals
- **Deadline management** - Set absolute time limits
- **Request-scoped values** - Share values within request context
- **Parent-child relationships** - Create context hierarchies
- **Performance optimization** - Efficient context management

### Implementation Details

```typescript
type ContextOptions = {
  timeout?: number;
  deadline?: Date;
  values?: Record<string, any>;
  parent?: Context;
};

class Context {
  constructor(options?: ContextOptions);

  cancel(): void;
  deadline(): Date | undefined;
  done(): Promise<void>;
  err(): Error | null;
  value(key: string): any;
  withValue(key: string, value: any): Context;
  withTimeout(timeout: number): Context;
  withDeadline(deadline: Date): Context;
  withCancel(): [Context, () => void];
}
```

### Core Functionality

1. **Context Management**
   - Create context with options
   - Cancel context and propagate cancellation
   - Set deadlines and timeouts
   - Manage request-scoped values

2. **Cancellation Support**
   - Propagate cancellation signals
   - Handle cancellation errors
   - Clean up resources on cancellation

### Usage Examples

```typescript
// Basic context
const ctx = new Context();

// Context with timeout
const ctx = new Context({ timeout: 5000 });
await ctx.done(); // Wait for cancellation or timeout

// Context with values
const ctx = new Context({ values: { user: 'john', id: 123 } });
const user = ctx.value('user'); // 'john'

// Context with cancellation
const [ctx, cancel] = new Context().withCancel();
go(async () => {
  await ctx.done();
  console.log('Context cancelled');
});
cancel(); // Cancel the context

// Context hierarchy
const parent = new Context({ timeout: 10000 });
const child = new Context({ parent, timeout: 5000 });
```

---

## Testing Strategy

### Select Testing (`src/__tests__/core/select.test.ts`)

- Test multiple channel cases
- Test send and receive operations
- Test timeout functionality
- Test default case handling
- Test concurrent access

### Timer Testing (`src/__tests__/timing/timer.test.ts`)

- Test timer accuracy
- Test cancellation functionality
- Test reset capability
- Test remaining time calculation
- Test concurrent timers

### Ticker Testing (`src/__tests__/timing/ticker.test.ts`)

- Test periodic execution
- Test interval configuration
- Test cancellation functionality
- Test channel integration
- Test dynamic interval changes

### Sleep Testing (`src/__tests__/timing/sleep.test.ts`)

- Test sleep accuracy
- Test cooperative yielding
- Test integration with other primitives
- Test performance characteristics

### Context Testing (`src/__tests__/core/context.test.ts`)

- Test cancellation propagation
- Test deadline functionality
- Test value management
- Test context hierarchies
- Test timeout handling

---

## Implementation Checklist

### Phase 3.1: Select

- [ ] Implement select function
- [ ] Add multiple channel case support
- [ ] Implement send/receive operations
- [ ] Add timeout functionality
- [ ] Add default case support
- [ ] Write comprehensive tests

### Phase 3.2: Timer

- [ ] Implement Timer class
- [ ] Add start/stop functionality
- [ ] Add reset capability
- [ ] Add remaining time calculation
- [ ] Write comprehensive tests

### Phase 3.3: Ticker

- [ ] Implement Ticker class
- [ ] Add periodic execution
- [ ] Add interval configuration
- [ ] Add channel integration
- [ ] Write comprehensive tests

### Phase 3.4: Sleep

- [ ] Implement sleep functions
- [ ] Add precise timing
- [ ] Add cooperative yielding
- [ ] Add integration with primitives
- [ ] Write comprehensive tests

### Phase 3.5: Context

- [ ] Implement Context class
- [ ] Add cancellation support
- [ ] Add deadline management
- [ ] Add value management
- [ ] Write comprehensive tests

---

## Dependencies

- **Phase 2 core primitives** - Channel, goroutine, mutex
- **Phase 1 utilities** - Error handling, validation, constants, helpers
- **Node.js built-ins** - Promise, setTimeout, setImmediate, AbortController

## Performance Considerations

- Minimize Promise creation overhead in select
- Use efficient timer management
- Optimize ticker interval handling
- Efficient context propagation
- Minimal memory allocations

## Next Steps

After completing Phase 3, we'll have advanced patterns and timing utilities implemented. The next phase will focus on higher-level patterns and utilities.

**Phase 4 will include:**

- `src/patterns/worker-pool.ts` - Managed goroutine pools
- `src/patterns/pipeline.ts` - Chained processing
- `src/patterns/fan-patterns.ts` - Fan-out/Fan-in patterns
- `src/patterns/rate-limiter.ts` - Request throttling
- `src/patterns/circuit-breaker.ts` - Fault tolerance
- `src/patterns/retry.ts` - Automatic retry mechanisms
