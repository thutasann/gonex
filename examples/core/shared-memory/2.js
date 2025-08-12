// @ts-check
import { SharedMemoryBuffer, BufferFlags } from '../../../dist/index.js';

console.log('=== Shared Memory Example 2: Advanced Buffer Operations ===\n');

// Example 2: Advanced buffer operations with header management
async function advancedBufferOperations() {
  console.log('1. Creating SharedMemoryBuffer with custom flags:');

  const buffer = new SharedMemoryBuffer(2048, {
    flags: BufferFlags.CHECKSUMED | BufferFlags.CIRCULAR,
    magic: 0x474f4e45, // "GONE"
    version: 1,
  });

  console.log('   Buffer created with checksum and circular flags');
  console.log(`   Total size: ${buffer.getSize().total} bytes`);
  console.log(`   Data size: ${buffer.getSize().data} bytes`);
  console.log(`   Header size: ${buffer.getSize().header} bytes`);

  // Get buffer header
  console.log('\n2. Buffer header information:');
  const header = buffer.getHeader();
  console.log(`   Magic: 0x${header.magic.toString(16).toUpperCase()}`);
  console.log(`   Version: ${header.version}`);
  console.log(`   Size: ${header.size} bytes`);
  console.log(`   Flags: 0x${header.flags.toString(16).toUpperCase()}`);
  console.log(`   Checksum: 0x${header.checksum.toString(16).toUpperCase()}`);

  // Validate header
  console.log('\n3. Header validation:');
  const isValid = buffer.validateHeader();
  console.log(`   Header valid: ${isValid}`);

  // Write data to buffer
  console.log('\n4. Writing data to buffer:');
  const testData = new TextEncoder().encode(
    'This is test data for the shared memory buffer!'
  );
  const bytesWritten = buffer.write(testData, 0);
  console.log(`   Wrote ${bytesWritten} bytes to buffer`);

  // Read data from buffer
  console.log('\n5. Reading data from buffer:');
  const readData = buffer.read(0, bytesWritten);
  const text = new TextDecoder().decode(readData);
  console.log(`   Read from buffer: "${text}"`);

  // Get buffer statistics
  console.log('\n6. Buffer statistics:');
  const stats = buffer.getStats();
  console.log(`   Bytes written: ${stats.bytesWritten}`);
  console.log(`   Bytes read: ${stats.bytesRead}`);
  console.log(`   Write count: ${stats.writeCount}`);
  console.log(`   Read count: ${stats.readCount}`);
  console.log(`   Last write: ${new Date(stats.lastWrite).toISOString()}`);
  console.log(`   Last read: ${new Date(stats.lastRead).toISOString()}`);

  // Check buffer state
  console.log('\n7. Buffer state:');
  console.log(`   Is empty: ${buffer.isEmpty()}`);
  console.log(`   Is full: ${buffer.isFull()}`);
  console.log(`   Available space: ${buffer.getAvailableSpace()} bytes`);
  console.log(`   Is read-only: ${buffer.isReadOnlyBuffer()}`);

  // Test checksum validation
  console.log('\n8. Checksum validation:');
  const checksumValid = buffer.validateHeader();
  console.log(`   Checksum valid after write: ${checksumValid}`);

  // Test partial writes and reads
  console.log('\n9. Partial operations:');
  const partialData = new TextEncoder().encode('Partial data');
  buffer.write(partialData, 100);
  console.log(`   Wrote partial data at offset 100`);

  const partialRead = buffer.read(100, 12);
  const partialText = new TextDecoder().decode(partialRead);
  console.log(`   Read partial data: "${partialText}"`);

  // Clear portion of buffer
  console.log('\n10. Clearing buffer portion:');
  buffer.clear(50, 25);
  console.log(`   Cleared 25 bytes starting at offset 50`);

  // Test read-only mode
  console.log('\n11. Read-only mode test:');
  buffer.setReadOnly(true);
  console.log(`   Buffer set to read-only`);

  try {
    buffer.write(new TextEncoder().encode('This should fail'), 0);
    console.log('   ERROR: Write should have failed in read-only mode');
  } catch (error) {
    console.log(`   ✓ Write correctly blocked: ${error.message}`);
  }

  // Reset statistics
  console.log('\n12. Resetting statistics:');
  buffer.resetStats();
  const resetStats = buffer.getStats();
  console.log(`   Stats reset - write count: ${resetStats.writeCount}`);

  // Final validation
  console.log('\n13. Final validation:');
  const finalValid = buffer.validateHeader();
  console.log(`   Final header validation: ${finalValid}`);

  console.log('\n   Advanced buffer operations completed successfully!');
}

// Run the example
advancedBufferOperations().catch(console.error);
