// @ts-check
import { SharedChannel } from '../../../dist/index.js';

console.log('=== Shared Channels Example 3: Channel State Management ===\n');

// Example 3: Channel state monitoring and management
async function channelStateManagement() {
  console.log('1. Creating SharedChannel for state monitoring:');

  const channel = new SharedChannel({
    bufferSize: 512 * 1024, // 512KB
    maxMessages: 50,
    enableBatching: false, // Disable batching for simpler state tracking
    enableChecksum: true,
    timeout: 15000, // 15 seconds
  });

  console.log('   Channel created for state monitoring');

  // Monitor channel state changes
  console.log('\n2. Monitoring channel state changes:');

  const monitorState = () => {
    const state = channel.getState();
    const memoryUsage = channel.getMemoryUsage();

    console.log(
      `   [${new Date().toISOString()}] State: length=${state.length}, ` +
        `utilization=${((state.length / state.capacity) * 100).toFixed(1)}%, ` +
        `memory=${((memoryUsage.usedSize / memoryUsage.totalSize) * 100).toFixed(1)}%`
    );

    return state;
  };

  // Initial state
  console.log('   Initial state:');
  let currentState = monitorState();

  // Fill channel gradually
  console.log('\n3. Gradually filling the channel:');

  const fillSteps = [10, 20, 30, 40, 45];
  for (let i = 0; i < fillSteps.length; i++) {
    const targetLength = fillSteps[i];
    const currentLength = channel.getLength();
    const toSend = targetLength - currentLength;

    if (toSend > 0) {
      console.log(`   Filling to ${targetLength} messages...`);

      for (let j = 0; j < toSend; j++) {
        await channel.send(`Message ${currentLength + j + 1}`);
      }

      currentState = monitorState();

      // Check if channel is getting full
      if (currentState.length >= currentState.capacity * 0.8) {
        console.log('   ⚠️  Channel is getting full!');
      }
    }
  }

  // Test channel limits
  console.log('\n4. Testing channel limits:');

  try {
    // Try to send more than capacity
    const overCapacity = currentState.capacity - currentState.length + 5;
    console.log(
      `   Attempting to send ${overCapacity} messages (capacity: ${currentState.capacity})...`
    );

    for (let i = 0; i < overCapacity; i++) {
      try {
        await channel.send(`Overflow message ${i + 1}`);
        console.log(`   ✓ Sent overflow message ${i + 1}`);
      } catch (error) {
        console.log(
          `   ❌ Failed to send overflow message ${i + 1}: ${error.message}`
        );
        break;
      }
    }
  } catch (error) {
    console.log(`   Channel overflow handled: ${error.message}`);
  }

  // Current state after overflow attempt
  currentState = monitorState();

  // Test channel clearing
  console.log('\n5. Testing channel clearing:');

  if (currentState.length > 0) {
    console.log(`   Clearing ${currentState.length} messages from channel...`);
    channel.clear();

    const afterClearState = monitorState();
    console.log(
      `   ✓ Channel cleared: length=${afterClearState.length}, isEmpty=${afterClearState.isEmpty}`
    );
  }

  // Test channel health
  console.log('\n6. Testing channel health:');

  const healthChecks = [
    () => channel.isHealthy(),
    () => channel.getState().length >= 0,
    () => channel.getState().length <= channel.getState().capacity,
  ];

  const healthResults = healthChecks.map((check, index) => {
    try {
      const result = check();
      console.log(`   Health check ${index + 1}: ${result ? 'PASS' : 'FAIL'}`);
      return result;
    } catch (error) {
      console.log(`   Health check ${index + 1}: ERROR - ${error.message}`);
      return false;
    }
  });

  const overallHealth = healthResults.every(result => result);
  console.log(
    `   Overall channel health: ${overallHealth ? 'HEALTHY' : 'UNHEALTHY'}`
  );

  // Test edge cases
  console.log('\n7. Testing edge cases:');

  // Send empty string
  try {
    await channel.send('');
    console.log('   ✓ Empty string sent successfully');
  } catch (error) {
    console.log(`   ❌ Failed to send empty string: ${error.message}`);
  }

  // Send very long message
  try {
    const longMessage = 'A'.repeat(1000);
    await channel.send(longMessage);
    console.log('   ✓ Long message sent successfully');
  } catch (error) {
    console.log(`   ❌ Failed to send long message: ${error.message}`);
  }

  // Test trySend and tryReceive
  console.log('\n8. Testing non-blocking operations:');

  const trySendResult = channel.trySend('Non-blocking message');
  console.log(`   trySend result: ${trySendResult}`);

  const tryReceiveResult = channel.tryReceive();
  console.log(
    `   tryReceive result: ${tryReceiveResult === undefined ? 'undefined' : tryReceiveResult}`
  );

  // Final state
  console.log('\n9. Final channel state:');
  const finalState = monitorState();
  const finalMemoryUsage = channel.getMemoryUsage();

  console.log(`   Final length: ${finalState.length}`);
  console.log(`   Final capacity: ${finalState.capacity}`);
  console.log(
    `   Final memory usage: ${finalMemoryUsage.usedSize}/${finalMemoryUsage.totalSize} bytes`
  );

  // Shutdown
  console.log('\n10. Shutting down channel:');
  channel.shutdown();
  console.log('   Channel shutdown completed');
}

// Run the example
channelStateManagement().catch(console.error);
