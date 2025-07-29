# Gonex Examples

This directory contains comprehensive examples demonstrating the core features of the `gonex` library - a GoLang-inspired concurrency package for Node.js.

## 📁 Examples Overview

### Core Features Examples

1. **`01-goroutines.js`** - Lightweight concurrent functions
   - Simple goroutines
   - Multiple concurrent operations
   - Return values from goroutines
   - Error handling
   - Async operations

2. **`02-channels.js`** - Typed communication between goroutines
   - Basic channel communication
   - Buffered channels
   - Channel timeouts
   - Channel closing
   - Multiple senders/receivers

3. **`03-waitgroup.js`** - Synchronization for multiple goroutines
   - Basic WaitGroup usage
   - Error handling with WaitGroups
   - Dynamic task management
   - Timeout handling
   - Nested WaitGroups

4. **`04-mutex.js`** - Mutual exclusion locks
   - Basic mutex usage
   - Mutex with timeout
   - TryLock functionality
   - Multiple resource management
   - Error handling

5. **`05-semaphore.js`** - Resource pooling and rate limiting
   - Basic semaphore usage
   - Semaphore with timeout
   - TryAcquire functionality
   - Resource pooling
   - Error handling

6. **`06-once.js`** - One-time initialization
   - Basic once usage
   - Error handling
   - Return value consistency
   - Timeout handling
   - Cleanup functions

7. **`07-combined.js`** - Real-world usage patterns
   - Web server simulation
   - Producer-consumer pattern
   - Resource management
   - Complex concurrency patterns

## 🚀 Running Examples

### Prerequisites

Make sure you have `gonex` installed:

```bash
npm install gonex
```

### Running Individual Examples

```bash
# Run a specific example
node examples/01-goroutines.js
node examples/02-channels.js
node examples/03-waitgroup.js
node examples/04-mutex.js
node examples/05-semaphore.js
node examples/06-once.js
node examples/07-combined.js
```

### Running All Examples

```bash
# Run all examples sequentially
for file in examples/*.js; do
  echo "Running $file..."
  node "$file"
  echo "----------------------------------------"
done
```

## 🎯 Key Concepts Demonstrated

### Goroutines (`go`)

- Lightweight concurrent functions
- Automatic scheduling and management
- Return values and error handling
- Non-blocking execution

### Channels (`channel`)

- Typed communication between goroutines
- Buffered and unbuffered channels
- Timeout support
- Channel closing and cleanup

### WaitGroup (`waitGroup`)

- Synchronization for multiple goroutines
- Dynamic task management
- Error handling and timeouts
- Nested synchronization

### Mutex (`mutex`)

- Mutual exclusion for shared resources
- Timeout and tryLock support
- Deadlock prevention
- Resource protection

### Semaphore (`semaphore`)

- Resource pooling and rate limiting
- Concurrent access control
- Timeout and tryAcquire support
- Connection and resource management

### Once (`once`)

- One-time initialization
- Thread-safe initialization
- Error handling and cleanup
- Consistent return values

## 🔧 Example Output

Each example demonstrates:

- **Concurrent execution** - Multiple operations running simultaneously
- **Synchronization** - Proper coordination between goroutines
- **Error handling** - Graceful error management
- **Resource management** - Proper cleanup and resource control
- **Real-world patterns** - Practical usage scenarios

## 📚 Learning Path

1. Start with **`01-goroutines.js`** to understand basic concurrency
2. Move to **`02-channels.js`** for communication patterns
3. Learn **`03-waitgroup.js`** for synchronization
4. Study **`04-mutex.js`** and **`05-semaphore.js`** for resource management
5. Understand **`06-once.js`** for initialization patterns
6. Explore **`07-combined.js`** for complex real-world scenarios

## 🛠️ Customization

Feel free to modify these examples to:

- Add your own business logic
- Experiment with different concurrency patterns
- Test error scenarios
- Explore performance characteristics
- Build upon the patterns shown

## 📖 Related Documentation

- [Gonex Documentation](https://github.com/thutasann/gonex)
- [NPM Package](https://www.npmjs.com/package/gonex)
- [API Reference](https://github.com/thutasann/gonex#api-reference)

---

**Happy coding with Gonex! 🚀**
