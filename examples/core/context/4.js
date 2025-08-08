// @ts-check
import { Background, withValue } from '../../../dist/index.js';

/**
 * Context Example 4: Context Values
 *
 * This example demonstrates how context values work:
 * 1. Creates contexts with values using withValue()
 * 2. Shows how values are inherited through the context chain
 * 3. Demonstrates value retrieval and inheritance
 */
console.log('=== Context Example 4: Context Values ===\n');

// Create contexts with values
const ctx1 = withValue(Background, 'user', 'john');
const ctx2 = withValue(ctx1, 'requestId', 'req-123');
const ctx3 = withValue(ctx2, 'sessionId', 'sess-456');

console.log('   User from context:', ctx3.value('user'));
console.log('   Request ID from context:', ctx3.value('requestId'));
console.log('   Session ID from context:', ctx3.value('sessionId'));
console.log('   Non-existent value:', ctx3.value('nonexistent'));

// Demonstrate value inheritance
console.log('\n   Value inheritance:');
console.log('   - Direct value (sessionId):', ctx3.value('sessionId'));
console.log('   - Inherited value (requestId):', ctx3.value('requestId'));
console.log('   - Inherited value (user):', ctx3.value('user'));

// Show that values are immutable and don't affect parent contexts
console.log('\n   Value isolation:');
console.log('   - Parent context (ctx1) user:', ctx1.value('user'));
console.log('   - Parent context (ctx1) requestId:', ctx1.value('requestId')); // Should be null

console.log('✅ Context values example completed!');
