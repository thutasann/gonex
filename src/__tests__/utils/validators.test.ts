import {
  InvalidBufferSizeError,
  InvalidConcurrencyError,
  InvalidTimeoutError,
  ValidationError,
} from '../../utils/errors';
import {
  validateBufferSize,
  validateChannelOperation,
  validateChannelOptions,
  validateCircuitBreakerOptions,
  validateConcurrencyLevel,
  validateContextOptions,
  validateContextValues,
  validateDeadline,
  validateDuration,
  validatePoolSize,
  validateRateLimiterOptions,
  validateRetryOptions,
  validateTimeout,
  validateWorkerPoolOptions,
} from '../../utils/validators';

describe('Validators', () => {
  describe('Time Validation', () => {
    describe('validateTimeout', () => {
      it('should accept valid timeout values', () => {
        expect(() => validateTimeout(1000)).not.toThrow();
        expect(() => validateTimeout(0)).not.toThrow();
        expect(() => validateTimeout(-1)).not.toThrow();
        expect(() => validateTimeout(86400000)).not.toThrow();
      });

      it('should reject invalid timeout values', () => {
        expect(() => validateTimeout(-2)).toThrow(InvalidTimeoutError);
        expect(() => validateTimeout(86400001)).toThrow(InvalidTimeoutError);
        expect(() => validateTimeout(NaN)).toThrow(InvalidTimeoutError);
        expect(() => validateTimeout('1000' as any)).toThrow(
          InvalidTimeoutError
        );
        expect(() => validateTimeout(undefined as any)).toThrow(
          InvalidTimeoutError
        );
      });

      it('should include parameter name in error', () => {
        expect(() => validateTimeout(-1, 'test-param')).toThrow(
          /for test-param/
        );
      });
    });

    describe('validateDeadline', () => {
      it('should accept valid deadline values', () => {
        const validDate = new Date();
        expect(() => validateDeadline(validDate)).not.toThrow();
      });

      it('should reject invalid deadline values', () => {
        expect(() => validateDeadline(new Date('invalid') as any)).toThrow(
          ValidationError
        );
        expect(() => validateDeadline('2023-12-31' as any)).toThrow(
          ValidationError
        );
        expect(() => validateDeadline(null as any)).toThrow(ValidationError);
      });
    });

    describe('validateDuration', () => {
      it('should accept valid duration values', () => {
        expect(() => validateDuration(1000)).not.toThrow();
        expect(() => validateDuration(0)).not.toThrow();
      });

      it('should reject invalid duration values', () => {
        expect(() => validateDuration(-1)).toThrow(ValidationError);
        expect(() => validateDuration(NaN)).toThrow(ValidationError);
        expect(() => validateDuration('1000' as any)).toThrow(ValidationError);
      });
    });
  });

  describe('Buffer and Size Validation', () => {
    describe('validateBufferSize', () => {
      it('should accept valid buffer sizes', () => {
        expect(() => validateBufferSize(0)).not.toThrow();
        expect(() => validateBufferSize(100)).not.toThrow();
        expect(() => validateBufferSize(1000000)).not.toThrow();
      });

      it('should reject invalid buffer sizes', () => {
        expect(() => validateBufferSize(-1)).toThrow(InvalidBufferSizeError);
        expect(() => validateBufferSize(1000001)).toThrow(
          InvalidBufferSizeError
        );
        expect(() => validateBufferSize(1.5)).toThrow(InvalidBufferSizeError);
        expect(() => validateBufferSize(NaN)).toThrow(InvalidBufferSizeError);
        expect(() => validateBufferSize('100' as any)).toThrow(
          InvalidBufferSizeError
        );
      });
    });

    describe('validateConcurrencyLevel', () => {
      it('should accept valid concurrency levels', () => {
        expect(() => validateConcurrencyLevel(1)).not.toThrow();
        expect(() => validateConcurrencyLevel(100)).not.toThrow();
        expect(() => validateConcurrencyLevel(10000)).not.toThrow();
      });

      it('should reject invalid concurrency levels', () => {
        expect(() => validateConcurrencyLevel(0)).toThrow(
          InvalidConcurrencyError
        );
        expect(() => validateConcurrencyLevel(10001)).toThrow(
          InvalidConcurrencyError
        );
        expect(() => validateConcurrencyLevel(1.5)).toThrow(
          InvalidConcurrencyError
        );
        expect(() => validateConcurrencyLevel(-1)).toThrow(
          InvalidConcurrencyError
        );
      });
    });

    describe('validatePoolSize', () => {
      it('should accept valid pool sizes', () => {
        expect(() => validatePoolSize(1)).not.toThrow();
        expect(() => validatePoolSize(100)).not.toThrow();
        expect(() => validatePoolSize(10000)).not.toThrow();
      });

      it('should reject invalid pool sizes', () => {
        expect(() => validatePoolSize(0)).toThrow(ValidationError);
        expect(() => validatePoolSize(10001)).toThrow(ValidationError);
        expect(() => validatePoolSize(1.5)).toThrow(ValidationError);
        expect(() => validatePoolSize(-1)).toThrow(ValidationError);
      });
    });
  });

  describe('Channel Validation', () => {
    describe('validateChannelOptions', () => {
      it('should accept valid channel options', () => {
        expect(() => validateChannelOptions({})).not.toThrow();
        expect(() => validateChannelOptions({ bufferSize: 10 })).not.toThrow();
        expect(() => validateChannelOptions({ timeout: 1000 })).not.toThrow();
        expect(() =>
          validateChannelOptions({ bufferSize: 10, timeout: 1000 })
        ).not.toThrow();
      });

      it('should reject invalid channel options', () => {
        expect(() => validateChannelOptions({ bufferSize: -1 })).toThrow(
          InvalidBufferSizeError
        );
        expect(() => validateChannelOptions({ timeout: -2 })).toThrow(
          InvalidTimeoutError
        );
      });
    });

    describe('validateChannelOperation', () => {
      it('should accept valid operations', () => {
        expect(() => validateChannelOperation('send')).not.toThrow();
        expect(() => validateChannelOperation('receive')).not.toThrow();
      });

      it('should reject invalid operations', () => {
        expect(() => validateChannelOperation('invalid' as any)).toThrow(
          ValidationError
        );
        expect(() => validateChannelOperation('SEND' as any)).toThrow(
          ValidationError
        );
      });
    });
  });

  describe('Context Validation', () => {
    describe('validateContextOptions', () => {
      it('should accept valid context options', () => {
        expect(() => validateContextOptions({})).not.toThrow();
        expect(() => validateContextOptions({ timeout: 1000 })).not.toThrow();
        expect(() =>
          validateContextOptions({ deadline: new Date() })
        ).not.toThrow();
      });

      it('should reject invalid context options', () => {
        expect(() => validateContextOptions({ timeout: -1 })).toThrow(
          InvalidTimeoutError
        );
        expect(() =>
          validateContextOptions({ deadline: new Date('invalid') as any })
        ).toThrow(ValidationError);
      });
    });

    describe('validateContextValues', () => {
      it('should accept valid context values', () => {
        expect(() => validateContextValues({})).not.toThrow();
        expect(() => validateContextValues({ key: 'value' })).not.toThrow();
        expect(() => validateContextValues(null as any)).not.toThrow();
      });

      it('should reject invalid context values', () => {
        expect(() => validateContextValues('invalid' as any)).toThrow(
          ValidationError
        );
        expect(() => validateContextValues(123 as any)).toThrow(
          ValidationError
        );
        expect(() => validateContextValues(undefined as any)).toThrow(
          ValidationError
        );
      });
    });
  });

  describe('Pattern Validation', () => {
    describe('validateWorkerPoolOptions', () => {
      it('should accept valid worker pool options', () => {
        expect(() => validateWorkerPoolOptions({ size: 10 })).not.toThrow();
        expect(() =>
          validateWorkerPoolOptions({ size: 10, timeout: 1000 })
        ).not.toThrow();
      });

      it('should reject invalid worker pool options', () => {
        expect(() => validateWorkerPoolOptions({ size: 0 })).toThrow(
          ValidationError
        );
        expect(() => validateWorkerPoolOptions({ size: 10001 })).toThrow(
          ValidationError
        );
        expect(() =>
          validateWorkerPoolOptions({ size: 10, timeout: -1 })
        ).toThrow(InvalidTimeoutError);
      });
    });

    describe('validateRateLimiterOptions', () => {
      it('should accept valid rate limiter options', () => {
        expect(() =>
          validateRateLimiterOptions({ limit: 100, timeWindow: 60000 })
        ).not.toThrow();
        expect(() =>
          validateRateLimiterOptions({
            limit: 100,
            timeWindow: 60000,
            burstSize: 10,
          })
        ).not.toThrow();
      });

      it('should reject invalid rate limiter options', () => {
        expect(() =>
          validateRateLimiterOptions({ limit: 0, timeWindow: 60000 })
        ).toThrow(ValidationError);
        expect(() =>
          validateRateLimiterOptions({ limit: 100, timeWindow: 0 })
        ).toThrow(ValidationError);
        expect(() =>
          validateRateLimiterOptions({
            limit: 100,
            timeWindow: 60000,
            burstSize: 0,
          })
        ).toThrow(ValidationError);
      });
    });

    describe('validateCircuitBreakerOptions', () => {
      it('should accept valid circuit breaker options', () => {
        expect(() =>
          validateCircuitBreakerOptions({
            failureThreshold: 5,
            recoveryTimeout: 60000,
          })
        ).not.toThrow();
        expect(() =>
          validateCircuitBreakerOptions({
            failureThreshold: 5,
            recoveryTimeout: 60000,
            halfOpenLimit: 3,
          })
        ).not.toThrow();
      });

      it('should reject invalid circuit breaker options', () => {
        expect(() =>
          validateCircuitBreakerOptions({
            failureThreshold: 0,
            recoveryTimeout: 60000,
          })
        ).toThrow(ValidationError);
        expect(() =>
          validateCircuitBreakerOptions({
            failureThreshold: 5,
            recoveryTimeout: 0,
          })
        ).toThrow(ValidationError);
        expect(() =>
          validateCircuitBreakerOptions({
            failureThreshold: 5,
            recoveryTimeout: 60000,
            halfOpenLimit: 0,
          })
        ).toThrow(ValidationError);
      });
    });

    describe('validateRetryOptions', () => {
      it('should accept valid retry options', () => {
        expect(() =>
          validateRetryOptions({ maxRetries: 3, delay: 1000 })
        ).not.toThrow();
        expect(() =>
          validateRetryOptions({ maxRetries: 3, delay: 1000, backoffFactor: 2 })
        ).not.toThrow();
        expect(() =>
          validateRetryOptions({ maxRetries: 3, delay: 1000, maxDelay: 30000 })
        ).not.toThrow();
      });

      it('should reject invalid retry options', () => {
        expect(() =>
          validateRetryOptions({ maxRetries: -1, delay: 1000 })
        ).toThrow(ValidationError);
        expect(() =>
          validateRetryOptions({ maxRetries: 3, delay: -1 })
        ).toThrow(ValidationError);
        expect(() =>
          validateRetryOptions({ maxRetries: 3, delay: 1000, backoffFactor: 0 })
        ).toThrow(ValidationError);
        expect(() =>
          validateRetryOptions({ maxRetries: 3, delay: 1000, maxDelay: -1 })
        ).toThrow(ValidationError);
      });
    });
  });
});
