/**
 * - Uses Node.js event loop
 * - Non-blocking but single-threaded
 * - Good for I/O-bound tasks
 * - No initialization required
 */
// @ts-check
import { goAll } from '../../../../dist/index.js';
import eventLoopTasks from '../../utils/event_loop_tasks.js';

const eventLoopResults = await goAll(eventLoopTasks);
console.log('Event Loop Results:', eventLoopResults);
console.log();
