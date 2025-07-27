import { InvalidTimeoutError } from '../../utils/errors';
import {
  createCancellablePromise,
  createTimeoutPromise,
  deepClone,
  isAsyncFunction,
  isPromise,
  isValidBufferSize,
  isValidTimeout,
  mergeOptions,
  nextTick,
  pick,
  setImmediateFn,
  sleep,
  yieldFn,
} from '../../utils/helpers';

describe('Helpers', () => {
  describe('sleep', () => {
    it('should sleep for the specified duration', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(90);
    });

    it('should throw error for invalid duration', () => {
      expect(() => sleep(-1)).toThrow(InvalidTimeoutError);
      expect(() => sleep(NaN)).toThrow(InvalidTimeoutError);
    });
  });

  describe('createTimeoutPromise', () => {
    it('should resolve when promise resolves before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await createTimeoutPromise(promise, 1000);

      expect(result).toBe('success');
    });

    it('should reject when promise takes longer than timeout', async () => {
      const promise = new Promise(resolve =>
        setTimeout(() => resolve('success'), 200)
      );

      await expect(createTimeoutPromise(promise, 100)).rejects.toThrow(
        'Operation timed out after 100ms'
      );
    });

    it('should reject when original promise rejects', async () => {
      const promise = Promise.reject(new Error('Original error'));

      await expect(createTimeoutPromise(promise, 1000)).rejects.toThrow(
        'Original error'
      );
    });
  });

  describe('createCancellablePromise', () => {
    it('should resolve when promise resolves before abort', async () => {
      const promise = Promise.resolve('success');
      const controller = new AbortController();
      const result = await createCancellablePromise(promise, controller.signal);

      expect(result).toBe('success');
    });

    it('should reject when aborted before promise resolves', async () => {
      const promise = new Promise(resolve =>
        setTimeout(() => resolve('success'), 200)
      );
      const controller = new AbortController();

      setTimeout(() => controller.abort(), 100);

      await expect(
        createCancellablePromise(promise, controller.signal)
      ).rejects.toThrow('Operation was aborted');
    });

    it('should reject immediately if already aborted', async () => {
      const promise = Promise.resolve('success');
      const controller = new AbortController();
      controller.abort();

      await expect(
        createCancellablePromise(promise, controller.signal)
      ).rejects.toThrow('Operation was aborted');
    });
  });

  describe('Type Guards', () => {
    describe('isPromise', () => {
      it('should return true for promises', () => {
        expect(isPromise(Promise.resolve())).toBe(true);
        expect(isPromise(new Promise(() => {}))).toBe(true);
      });

      it('should return false for non-promises', () => {
        expect(isPromise('string')).toBe(false);
        expect(isPromise(123)).toBe(false);
        expect(isPromise({})).toBe(false);
        expect(isPromise(null)).toBe(false);
        expect(isPromise(undefined)).toBe(false);
      });
    });

    describe('isAsyncFunction', () => {
      it('should return true for async functions', () => {
        const asyncFn = async () => {};
        expect(isAsyncFunction(asyncFn)).toBe(true);
      });

      it('should return false for non-async functions', () => {
        const syncFn = () => {};
        expect(isAsyncFunction(syncFn)).toBe(false);
        expect(isAsyncFunction('string')).toBe(false);
        expect(isAsyncFunction(123)).toBe(false);
      });
    });

    describe('isValidTimeout', () => {
      it('should return true for valid timeouts', () => {
        expect(isValidTimeout(0)).toBe(true);
        expect(isValidTimeout(1000)).toBe(true);
        expect(isValidTimeout(86400000)).toBe(true);
        expect(isValidTimeout(-1)).toBe(true);
      });

      it('should return false for invalid timeouts', () => {
        expect(isValidTimeout(-2)).toBe(false);
        expect(isValidTimeout(86400001)).toBe(false);
        expect(isValidTimeout(NaN)).toBe(false);
        expect(isValidTimeout('1000')).toBe(false);
      });
    });

    describe('isValidBufferSize', () => {
      it('should return true for valid buffer sizes', () => {
        expect(isValidBufferSize(0)).toBe(true);
        expect(isValidBufferSize(100)).toBe(true);
        expect(isValidBufferSize(1000000)).toBe(true);
      });

      it('should return false for invalid buffer sizes', () => {
        expect(isValidBufferSize(-1)).toBe(false);
        expect(isValidBufferSize(1000001)).toBe(false);
        expect(isValidBufferSize(1.5)).toBe(false);
        expect(isValidBufferSize(NaN)).toBe(false);
      });
    });
  });

  describe('Object Utilities', () => {
    describe('deepClone', () => {
      it('should clone primitive values', () => {
        expect(deepClone('string')).toBe('string');
        expect(deepClone(123)).toBe(123);
        expect(deepClone(true)).toBe(true);
        expect(deepClone(null)).toBe(null);
      });

      it('should clone arrays', () => {
        const original = [1, 2, 3, { a: 1 }];
        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned[3]).not.toBe(original[3]);
      });

      it('should clone objects', () => {
        const original = { a: 1, b: { c: 2 } };
        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.b).not.toBe(original.b);
      });

      it('should clone dates', () => {
        const original = new Date('2023-01-01');
        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.getTime()).toBe(original.getTime());
      });
    });

    describe('mergeOptions', () => {
      it('should merge options with defaults', () => {
        const defaults = { a: 1, b: 2, c: 3 };
        const options = { b: 5, d: 4 };
        const result = mergeOptions(defaults, options);

        expect(result).toEqual({ a: 1, b: 5, c: 3, d: 4 });
        expect(result).not.toBe(defaults);
        expect(result).not.toBe(options);
      });

      it('should handle undefined options', () => {
        const defaults = { a: 1, b: 2 };
        const result = mergeOptions(defaults, undefined as any);

        expect(result).toEqual(defaults);
        expect(result).not.toBe(defaults);
      });

      it('should ignore undefined values in options', () => {
        const defaults = { a: 1, b: 2 };
        const options = { b: undefined, c: 3 };
        const result = mergeOptions(defaults, options);

        expect(result).toEqual({ a: 1, b: 2, c: 3 });
      });
    });

    describe('pick', () => {
      it('should pick specified keys', () => {
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        const result = pick(obj, ['a', 'c']);

        expect(result).toEqual({ a: 1, c: 3 });
      });

      it('should ignore non-existent keys', () => {
        const obj = { a: 1, b: 2 };
        // @ts-ignore
        const result = pick(obj, ['a', 'c', 'd']);

        expect(result).toEqual({ a: 1 });
      });

      it('should return empty object for no keys', () => {
        const obj = { a: 1, b: 2 };
        const result = pick(obj, []);

        expect(result).toEqual({});
      });
    });
  });

  describe('Event Loop Utilities', () => {
    describe('nextTick', () => {
      it('should resolve on next tick', async () => {
        const start = Date.now();
        await nextTick();
        const end = Date.now();

        expect(end - start).toBeLessThan(10);
      });
    });

    describe('setImmediate', () => {
      it('should resolve on next immediate', async () => {
        const start = Date.now();
        await setImmediateFn();
        const end = Date.now();

        expect(end - start).toBeLessThan(10);
      });
    });

    describe('yield', () => {
      it('should yield to next tick', async () => {
        const start = Date.now();
        await yieldFn();
        const end = Date.now();

        expect(end - start).toBeLessThan(10);
      });
    });
  });
});
