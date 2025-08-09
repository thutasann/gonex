# Condition Variable (Cond) Examples

This directory contains examples demonstrating the usage of Go-style condition variables in Node.js using the `Cond` primitive.

## Examples

### 1. Basic Producer-Consumer Pattern (`1.js`)

Demonstrates the fundamental usage of condition variables with a producer that signals when work is ready and consumers that wait for the condition.

### 2. Broadcast to Multiple Waiters (`2.js`)

Shows how to use `broadcast()` to wake up all goroutines waiting on a condition when multiple workers reach a target.

### 3. Timeout Handling (`3.js`)

Illustrates timeout functionality and the convenience `cond()` function that creates a condition variable with an internal mutex.

### 4. Queue Processing with Signal (`4.js`)

Demonstrates proper usage of `signal()` for waking one waiting goroutine in a producer-consumer queue scenario.

### 5. Multi-threaded Worker Processing (`5.js`)

Advanced example showing condition variables working with true parallelism using worker threads. Features:

- Multiple worker threads processing CPU-intensive tasks
- Condition variables coordinating task distribution
- Performance monitoring and statistics
- Complex coordination between main thread and worker threads
- Demonstrates real parallel execution with CPU-intensive computations

**Note**: This example demonstrates clean completion - all coordinators exit gracefully when work is done.

## Key Concepts

### Condition Variables

A condition variable is a synchronization primitive that allows goroutines to wait for or signal the occurrence of events. It's always used in conjunction with a mutex.

### Typical Usage Pattern

```typescript
await mutex.lock();
while (!condition()) {
  await cond.wait();
}
// ... use the resource ...
mutex.unlock();
```

### Important Notes

- Always hold the mutex when checking the condition and calling `wait()`
- Use `wait()` in a loop, as the condition might still be false when wait returns
- `signal()` wakes one waiting goroutine (FIFO order)
- `broadcast()` wakes all waiting goroutines
- The mutex is automatically unlocked during `wait()` and re-acquired when returning

## Running Examples

```bash
# Run individual examples
node examples/core/cond/1.js
node examples/core/cond/2.js
node examples/core/cond/3.js
node examples/core/cond/4.js
node examples/core/cond/5.js

# Or use the examples package.json
cd examples && npm run cond:1
```
