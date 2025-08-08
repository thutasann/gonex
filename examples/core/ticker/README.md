# Ticker Examples

This directory contains examples demonstrating the `ticker` functionality in Gonex, which provides high-performance periodic event generation similar to Go's `time.Ticker`.

## Overview

The `ticker` creates a channel that sends periodic events at specified intervals. It's optimized for:
- Minimal memory allocations
- Fast start/stop operations
- Precise interval timing
- Efficient channel integration

## Examples

### 1. Basic Ticker Usage (`1.js`)
**Demonstrates:** Simple periodic events with basic ticker lifecycle management.

**Key Features:**
- Creating a ticker with a specific interval
- Starting the ticker and receiving events
- Stopping the ticker after a certain time
- Basic error handling

**Use Cases:**
- Simple periodic tasks
- Basic monitoring scenarios
- Learning ticker fundamentals

### 2. Multiple Tickers with Different Intervals (`2.js`)
**Demonstrates:** Running multiple tickers concurrently with different intervals.

**Key Features:**
- Multiple tickers with varying speeds
- Concurrent processing with `goAll`
- Different ticker behaviors
- Performance comparison

**Use Cases:**
- Multi-rate monitoring systems
- Performance testing
- Complex timing scenarios

### 3. Dynamic Ticker Control (`3.js`)
**Demonstrates:** Changing ticker intervals dynamically and monitoring state.

**Key Features:**
- Dynamic interval changes
- State monitoring
- Complex lifecycle management
- Phase-based behavior

**Use Cases:**
- Adaptive monitoring systems
- Dynamic rate limiting
- Complex timing logic

### 4. Error Handling and Timeouts (`4.js`)
**Demonstrates:** Robust error handling and timeout scenarios.

**Key Features:**
- Graceful error handling
- Timeout management
- Error recovery mechanisms
- Robust lifecycle management

**Use Cases:**
- Production monitoring systems
- Error-prone environments
- Robust application design

### 5. Data Processing and Real-world Scenarios (`5.js`)
**Demonstrates:** Complex data processing with multiple tickers and channels.

**Key Features:**
- Real-world monitoring simulation
- Complex data flow
- Multiple channel coordination
- Sensor data processing

**Use Cases:**
- IoT monitoring systems
- Data collection pipelines
- Complex monitoring scenarios

## Running the Examples

```bash
# Run a specific example
node examples/core/ticker/1.js

# Run all examples
cd examples/core/ticker
for file in *.js; do
  echo "Running $file..."
  node "$file"
  echo "----------------------------------------"
done
```

## Ticker API

### Creating a Ticker
```javascript
import { ticker } from 'gonex';

const tickerInstance = ticker({ 
  interval: 1000,  // milliseconds
  name: 'MyTicker' // optional
});
```

### Starting and Stopping
```javascript
// Start ticker and get channel
const channel = tickerInstance.start();

// Stop ticker
tickerInstance.stop();
```

### Receiving Events
```javascript
// Receive tick events
const tick = await channel.receive();
console.log(`Tick ${tick}: ${new Date().toLocaleTimeString()}`);
```

### Dynamic Control
```javascript
// Change interval
tickerInstance.setInterval(500);

// Check state
console.log(`Is running: ${tickerInstance.getIsRunning()}`);
console.log(`Tick count: ${tickerInstance.getTickCount()}`);
console.log(`Current interval: ${tickerInstance.getInterval()}ms`);
```

## Best Practices

1. **Always stop tickers** when done to prevent memory leaks
2. **Handle channel closure** gracefully in your receivers
3. **Use appropriate buffer sizes** for your use case
4. **Monitor ticker state** in production applications
5. **Handle errors** in ticker receivers

## Performance Considerations

- Tickers are optimized for minimal memory allocations
- Use buffered channels for high-frequency tickers
- Consider using `tryReceive()` for non-blocking operations
- Monitor ticker performance in production environments

## Error Handling

Tickers can throw errors in various scenarios:
- Channel timeout errors
- Processing errors in receivers
- Memory pressure in high-frequency scenarios

Always wrap ticker operations in try-catch blocks for production use.
