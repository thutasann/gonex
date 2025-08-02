// @ts-check
import { goAll } from '../../../../dist/index.js';
import eventLoopTasks from '../../../utils/event_loop_tasks.js';

console.log('=== Execution Modes Demo ===\n');

// Example 1: Event Loop Execution (Single-threaded concurrency)
console.log('1. Event Loop Execution (Single-threaded concurrency):');
console.log('   - Uses Node.js event loop');
console.log('   - Non-blocking but single-threaded');
console.log('   - Good for I/O-bound tasks');
console.log('   - No initialization required\n');

const eventLoopResults = await goAll(eventLoopTasks);
console.log('Event Loop Results:', eventLoopResults);
console.log();
