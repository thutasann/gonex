// @ts-check
import {
  go,
  initializeParallelScheduler,
  shutdownParallelScheduler,
} from '../../../dist/index.js';

async function testSimpleImports() {
  console.log('Testing simple external import functionality...');

  // Initialize parallel scheduler with worker threads
  await initializeParallelScheduler({
    useWorkerThreads: true,
    threadCount: 2,
  });

  try {
    // Test 1: Function with Node.js built-in module
    console.log('\n1. Testing function with Node.js built-in module...');
    const result1 = await go(
      async () => {
        const fs = (await import('node:fs')).default;
        console.log('FS module imported successfully in worker thread');
        return {
          existsSync: typeof fs.existsSync === 'function',
          readFileSync: typeof fs.readFileSync === 'function',
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('FS module result:', result1);

    // Test 2: Function with path module
    console.log('\n2. Testing function with path module...');
    const result2 = await go(
      async () => {
        const path = (await import('node:path')).default;
        console.log('Path module imported successfully');
        return {
          join: typeof path.join === 'function',
          resolve: typeof path.resolve === 'function',
          example: path.join('test', 'file.js'),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Path module result:', result2);

    // Test 3: Function with crypto module
    console.log('\n3. Testing function with crypto module...');
    const result3 = await go(
      async () => {
        const crypto = (await import('node:crypto')).default;
        console.log('Crypto module imported successfully');
        return {
          randomBytes: typeof crypto.randomBytes === 'function',
          createHash: typeof crypto.createHash === 'function',
          randomValue: crypto.randomBytes(4).toString('hex'),
        };
      },
      [],
      { useWorkerThreads: true }
    );
    console.log('Crypto module result:', result3);

    // Test 4: Function with dynamic import based on argument
    console.log('\n4. Testing function with dynamic import...');
    const result4 = await go(
      async moduleName => {
        console.log(`Attempting to import: ${moduleName}`);
        const module = (await import(moduleName)).default;
        return {
          moduleName,
          success: true,
          exports: Object.keys(module),
        };
      },
      ['node:fs', 'node:path', 'node:crypto'],
      { useWorkerThreads: true }
    );
    console.log('Dynamic import result:', result4);

    console.log('\nAll simple import tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Shutdown the parallel scheduler
    await shutdownParallelScheduler();
  }
}

testSimpleImports().catch(console.error);
