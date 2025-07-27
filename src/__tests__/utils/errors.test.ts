import {
  ChannelBufferFullError,
  ChannelClosedError,
  ChannelError,
  ChannelTimeoutError,
  ContextCancelledError,
  ContextDeadlineExceededError,
  ContextTimeoutError,
  GonexError,
  InvalidBufferSizeError,
  InvalidConcurrencyError,
  InvalidTimeoutError,
  MutexAlreadyLockedError,
  MutexLockTimeoutError,
  SemaphoreTimeoutError,
  WaitGroupNegativeCounterError,
} from '../../utils/errors';

describe('Error System', () => {
  describe('GonexError', () => {
    it('should create a base error with message and code', () => {
      const error = new GonexError('Test error', 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('GonexError');
      expect(error.context).toBeUndefined();
    });

    it('should create a base error with context', () => {
      const context = { key: 'value' };
      const error = new GonexError('Test error', 'TEST_ERROR', context);

      expect(error.context).toEqual(context);
    });

    it('should serialize to JSON', () => {
      const context = { key: 'value' };
      const error = new GonexError('Test error', 'TEST_ERROR', context);
      const json = error.toJSON();

      expect(json).toMatchObject({
        name: 'GonexError',
        message: 'Test error',
        code: 'TEST_ERROR',
        context,
      });
      expect(json.stack).toBeDefined();
    });
  });

  describe('ChannelError', () => {
    it('should create channel error', () => {
      const error = new ChannelError('Channel error', 'CHANNEL_ERROR');

      expect(error.message).toBe('Channel error');
      expect(error.code).toBe('CHANNEL_ERROR');
      expect(error.name).toBe('ChannelError');
    });

    it('should create channel closed error', () => {
      const error = new ChannelClosedError('test-channel');

      expect(error.message).toBe('Channel "test-channel" is closed');
      expect(error.code).toBe('CHANNEL_CLOSED');
      expect(error.context).toEqual({ channelName: 'test-channel' });
    });

    it('should create channel timeout error', () => {
      const error = new ChannelTimeoutError(1000, 'test-channel');

      expect(error.message).toBe(
        'Channel operation timed out after 1000ms on channel "test-channel"'
      );
      expect(error.code).toBe('CHANNEL_TIMEOUT');
      expect(error.context).toEqual({
        timeout: 1000,
        channelName: 'test-channel',
      });
    });

    it('should create channel buffer full error', () => {
      const error = new ChannelBufferFullError('test-channel');

      expect(error.message).toBe('Channel "test-channel" buffer is full');
      expect(error.code).toBe('CHANNEL_BUFFER_FULL');
      expect(error.context).toEqual({ channelName: 'test-channel' });
    });
  });

  describe('ContextError', () => {
    it('should create context cancelled error', () => {
      const error = new ContextCancelledError('User cancelled');

      expect(error.message).toBe('Context was cancelled: User cancelled');
      expect(error.code).toBe('CONTEXT_CANCELLED');
      expect(error.context).toEqual({ reason: 'User cancelled' });
    });

    it('should create context timeout error', () => {
      const error = new ContextTimeoutError(5000);

      expect(error.message).toBe('Context timed out after 5000ms');
      expect(error.code).toBe('CONTEXT_TIMEOUT');
      expect(error.context).toEqual({ timeout: 5000 });
    });

    it('should create context deadline exceeded error', () => {
      const deadline = new Date('2023-12-31T23:59:59Z');
      const error = new ContextDeadlineExceededError(deadline);

      expect(error.message).toBe(
        'Context deadline exceeded at 2023-12-31T23:59:59.000Z'
      );
      expect(error.code).toBe('CONTEXT_DEADLINE_EXCEEDED');
      expect(error.context).toEqual({ deadline });
    });
  });

  describe('MutexError', () => {
    it('should create mutex lock timeout error', () => {
      const error = new MutexLockTimeoutError(3000, 'test-mutex');

      expect(error.message).toBe(
        'Failed to acquire mutex lock within 3000ms on mutex "test-mutex"'
      );
      expect(error.code).toBe('MUTEX_LOCK_TIMEOUT');
      expect(error.context).toEqual({ timeout: 3000, mutexName: 'test-mutex' });
    });

    it('should create mutex already locked error', () => {
      const error = new MutexAlreadyLockedError('test-mutex');

      expect(error.message).toBe('Mutex "test-mutex" is already locked');
      expect(error.code).toBe('MUTEX_ALREADY_LOCKED');
      expect(error.context).toEqual({ mutexName: 'test-mutex' });
    });
  });

  describe('WaitGroupError', () => {
    it('should create wait group negative counter error', () => {
      const error = new WaitGroupNegativeCounterError(-1);

      expect(error.message).toBe('WaitGroup counter cannot be negative: -1');
      expect(error.code).toBe('WAITGROUP_NEGATIVE_COUNTER');
      expect(error.context).toEqual({ counter: -1 });
    });
  });

  describe('SemaphoreError', () => {
    it('should create semaphore timeout error', () => {
      const error = new SemaphoreTimeoutError(2000, 'test-semaphore');

      expect(error.message).toBe(
        'Failed to acquire semaphore within 2000ms on semaphore "test-semaphore"'
      );
      expect(error.code).toBe('SEMAPHORE_TIMEOUT');
      expect(error.context).toEqual({
        timeout: 2000,
        semaphoreName: 'test-semaphore',
      });
    });
  });

  describe('ValidationError', () => {
    it('should create invalid timeout error', () => {
      const error = new InvalidTimeoutError('invalid', 'test-param');

      expect(error.message).toBe(
        'Invalid timeout value: invalid for test-param. Must be a positive number or -1 for infinite'
      );
      expect(error.code).toBe('INVALID_TIMEOUT');
      expect(error.context).toEqual({ timeout: 'invalid', name: 'test-param' });
    });

    it('should create invalid buffer size error', () => {
      const error = new InvalidBufferSizeError(-1, 'test-param');

      expect(error.message).toBe(
        'Invalid buffer size: -1 for test-param. Must be a non-negative integer'
      );
      expect(error.code).toBe('INVALID_BUFFER_SIZE');
      // @ts-ignore
      expect(error.context).toEqual({ size: -1, name: test - param });
    });

    it('should create invalid concurrency error', () => {
      const error = new InvalidConcurrencyError(0, 'test-param');

      expect(error.message).toBe(
        'Invalid concurrency level: 0 for test-param. Must be a positive integer'
      );
      expect(error.code).toBe('INVALID_CONCURRENCY_LEVEL');
      expect(error.context).toEqual({ level: 0, name: 'test-param' });
    });
  });
});
