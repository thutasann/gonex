# Context with Values + Worker Threads Examples

This directory contains examples demonstrating how context values work with worker threads in the Gonex library.

## Examples

### 5.js - Context with Values + Worker Threads

This example demonstrates comprehensive context value functionality with worker threads:

#### Features Demonstrated:

1. **Basic Context Values**: Simple key-value pairs accessible in worker threads
2. **Context Value Inheritance**: Values inherited from parent contexts
3. **Complex Context Values**: Objects, arrays, and nested structures
4. **Context Cancellation with Values**: Cancellation while preserving context values
5. **Nested Context Values**: Multiple levels of context value inheritance

#### Key Capabilities:

✅ **Context Value Serialization**: Context values are properly serialized and passed to worker threads  
✅ **Value Access in Workers**: Worker threads can access context values using `context.value(key)`  
✅ **Complex Object Support**: Objects, arrays, and nested structures are supported  
✅ **Value Inheritance**: Child contexts inherit values from parent contexts  
✅ **Cancellation with Values**: Context cancellation works while preserving values  
✅ **Real-time Updates**: Context state changes are propagated to worker threads

#### Example Output:

```
=== Context Example 5: Worker Thread + Context with Values ===

1. Basic Context Values with Worker Threads:
   Context values in worker thread:
     User: {"id":123,"name":"John Doe"}
     Request ID: req-456
     Session: {"token":"abc123","expires":1754664288017}
   Working... step 1 for user John Doe

2. Context Value Inheritance and Updates:
   Worker 0 context values:
     Environment: production
     User ID: 789
   Worker 0... step 1 (env: production)

3. Complex Context Values with Functions and Objects:
   Complex context values in worker thread:
     Config: {"apiUrl":"https://api.example.com","timeout":5000,"retries":3}
     Auth: {"token":"bearer-xyz789","permissions":["read","write","delete"]}
   API call 1 to https://api.example.com with token bearer-xyz...

4. Context Value Updates and Dynamic Behavior:
   Initial values - Counter: 0, User: {"name":"Alice","status":"active"}
   Step 1 - Counter: 0, User status: active

5. Nested Context Values with Multiple Levels:
   Nested context values - Level: 4, Final: true
   Nested work step 1 at level 4
```

#### Usage Patterns:

```javascript
// Create context with values
const ctx1 = withValue(Background, 'user', { id: 123, name: 'John Doe' });
const ctx2 = withValue(ctx1, 'requestId', 'req-456');

// Use in worker thread
go(
  async context => {
    const user = context.value('user');
    const requestId = context.value('requestId');
    console.log(`Working for user ${user.name} with request ${requestId}`);
  },
  [ctx2],
  { useWorkerThreads: true }
);
```

#### Technical Implementation:

- **Context Serialization**: Context objects are serialized with their values when passed to worker threads
- **Proxy Context**: Worker threads receive proxy context objects that mimic the original interface
- **Value Lookup**: Context values are looked up in the serialized data and updated state
- **Real-time Updates**: Context state changes are broadcast to all worker threads
- **Value Inheritance**: Child contexts inherit values from parent contexts through the context chain

This example demonstrates the full power of context values in a distributed worker thread environment, showing how Gonex maintains Go-like context semantics across thread boundaries.
