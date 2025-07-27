// Simple Jest setup for gonex
import '@jest/globals';

// Set global timeout for async tests
jest.setTimeout(10000);

// Global test utilities
export const testUtils = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  randomString: (length = 10) => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  },

  randomNumber: (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
};

// Test constants
export const TEST_CONSTANTS = {
  SMALL_TIMEOUT: 100,
  MEDIUM_TIMEOUT: 1000,
  LARGE_TIMEOUT: 5000,

  SMALL_BUFFER: 10,
  MEDIUM_BUFFER: 100,
  LARGE_BUFFER: 1000,

  SMALL_POOL: 2,
  MEDIUM_POOL: 5,
  LARGE_POOL: 10,
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});
