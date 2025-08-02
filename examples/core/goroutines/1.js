// @ts-check
import { go } from '../../../dist/index.js';

console.log('=== Goroutines Example ===\n');

// Example 1: Simple goroutine
console.log('1. Simple goroutine:');
go(async () => {
  console.log('   Hello from goroutine!');
});
