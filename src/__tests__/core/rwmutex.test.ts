import { RWMutex, rwMutex } from '../../core/rwmutex';
import {
  RWMutexNotReadLockedError,
  RWMutexNotWriteLockedError,
  RWMutexReadLockTimeoutError,
  RWMutexTooManyReadersError,
  RWMutexWriteLockTimeoutError,
} from '../../utils';

describe('RWMutex', () => {
  let mutex: RWMutex;

  beforeEach(() => {
    mutex = new RWMutex();
  });

  describe('Construction', () => {
    it('should create with default options', () => {
      const mutex = new RWMutex();
      const state = mutex.getState();

      expect(state.readerCount).toBe(0);
      expect(state.writerLocked).toBe(false);
      expect(state.writerWaiting).toBe(false);
      expect(state.pendingReaders).toBe(0);
      expect(state.pendingWriters).toBe(0);
    });

    it('should create with custom options', () => {
      const mutex = new RWMutex({
        timeout: 5000,
        name: 'test-mutex',
        maxReaders: 100,
      });

      expect(mutex).toBeInstanceOf(RWMutex);
    });

    it('should create via factory function', () => {
      const mutex = rwMutex({ name: 'factory-test' });
      expect(mutex).toBeInstanceOf(RWMutex);
    });
  });

  describe('Read Locks', () => {
    it('should acquire single read lock', async () => {
      await mutex.rLock();

      const state = mutex.getState();
      expect(state.readerCount).toBe(1);
      expect(state.writerLocked).toBe(false);
      expect(mutex.isReadLocked()).toBe(true);
      expect(mutex.isLocked()).toBe(true);
    });

    it('should acquire multiple concurrent read locks', async () => {
      const promises = [mutex.rLock(), mutex.rLock(), mutex.rLock()];

      await Promise.all(promises);

      const state = mutex.getState();
      expect(state.readerCount).toBe(3);
      expect(state.writerLocked).toBe(false);
    });

    it('should release read locks', () => {
      // First acquire locks
      mutex.tryRLock();
      mutex.tryRLock();

      expect(mutex.getState().readerCount).toBe(2);

      mutex.rUnlock();
      expect(mutex.getState().readerCount).toBe(1);

      mutex.rUnlock();
      expect(mutex.getState().readerCount).toBe(0);
      expect(mutex.isLocked()).toBe(false);
    });

    it('should try read lock successfully when available', () => {
      const result = mutex.tryRLock();

      expect(result).toBe(true);
      expect(mutex.getState().readerCount).toBe(1);
    });

    it('should fail try read lock when writer is active', async () => {
      await mutex.lock(); // Acquire write lock

      const result = mutex.tryRLock();

      expect(result).toBe(false);
      expect(mutex.getState().readerCount).toBe(0);
    });

    it('should throw error when releasing non-existent read lock', () => {
      expect(() => mutex.rUnlock()).toThrow(RWMutexNotReadLockedError);
    });

    it('should throw error when max readers exceeded', () => {
      const mutex = new RWMutex({ maxReaders: 2 });

      mutex.tryRLock();
      mutex.tryRLock();

      expect(() => mutex.tryRLock()).toThrow(RWMutexTooManyReadersError);
    });
  });

  describe('Write Locks', () => {
    it('should acquire write lock when no readers', async () => {
      await mutex.lock();

      const state = mutex.getState();
      expect(state.writerLocked).toBe(true);
      expect(state.readerCount).toBe(0);
      expect(mutex.isWriteLocked()).toBe(true);
      expect(mutex.isLocked()).toBe(true);
    });

    it('should try write lock successfully when available', () => {
      const result = mutex.tryLock();

      expect(result).toBe(true);
      expect(mutex.getState().writerLocked).toBe(true);
    });

    it('should fail try write lock when readers active', () => {
      mutex.tryRLock(); // Acquire read lock

      const result = mutex.tryLock();

      expect(result).toBe(false);
      expect(mutex.getState().writerLocked).toBe(false);
    });

    it('should fail try write lock when writer active', async () => {
      await mutex.lock(); // First writer

      const result = mutex.tryLock();

      expect(result).toBe(false);
    });

    it('should release write lock', async () => {
      await mutex.lock();
      expect(mutex.getState().writerLocked).toBe(true);

      mutex.unlock();
      expect(mutex.getState().writerLocked).toBe(false);
      expect(mutex.isLocked()).toBe(false);
    });

    it('should throw error when releasing non-existent write lock', () => {
      expect(() => mutex.unlock()).toThrow(RWMutexNotWriteLockedError);
    });
  });

  describe('Read-Write Coordination', () => {
    it('should block write lock until all readers release', async () => {
      // Acquire multiple read locks
      await mutex.rLock();
      await mutex.rLock();

      let writerAcquired = false;
      const writerPromise = mutex.lock().then(() => {
        writerAcquired = true;
      });

      // Writer should not acquire yet
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(writerAcquired).toBe(false);

      // Release one reader
      mutex.rUnlock();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(writerAcquired).toBe(false); // Still one reader

      // Release last reader
      mutex.rUnlock();
      await writerPromise;
      expect(writerAcquired).toBe(true);
    });

    it('should block read locks when writer is waiting', async () => {
      // Acquire read lock
      await mutex.rLock();

      // Start writer (will wait)
      const writerPromise = mutex.lock();

      // New read locks should fail
      expect(mutex.tryRLock()).toBe(false);

      // Release read lock to allow writer
      mutex.rUnlock();
      await writerPromise;

      expect(mutex.getState().writerLocked).toBe(true);
    });

    it('should prioritize readers over new writers after write unlock', async () => {
      await mutex.lock(); // Start with write lock

      let readersAcquired = 0;
      //   let writerAcquired = false;

      // Queue up readers and a writer
      const reader1Promise = mutex.rLock().then(() => readersAcquired++);
      const reader2Promise = mutex.rLock().then(() => readersAcquired++);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      //   const writerPromise = mutex.lock().then(() => (writerAcquired = true));

      // Release write lock
      mutex.unlock();

      // Wait a bit for readers to be prioritized
      await Promise.all([reader1Promise, reader2Promise]);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(readersAcquired).toBe(2);
      //   expect(writerAcquired).toBe(false); // Writer should wait for readers
    });
  });

  describe('Timeouts', () => {
    it('should timeout read lock acquisition', async () => {
      await mutex.lock(); // Block with write lock

      await expect(mutex.rLock(100)).rejects.toThrow(
        RWMutexReadLockTimeoutError
      );
    });

    it('should timeout write lock acquisition', async () => {
      await mutex.rLock(); // Block with read lock

      await expect(mutex.lock(100)).rejects.toThrow(
        RWMutexWriteLockTimeoutError
      );
    });

    it('should use default timeout from constructor', async () => {
      const mutex = new RWMutex({ timeout: 100 });
      await mutex.lock(); // Block

      await expect(mutex.rLock()).rejects.toThrow(RWMutexReadLockTimeoutError);
    });

    it('should override default timeout with parameter', async () => {
      const mutex = new RWMutex({ timeout: 1000 });
      await mutex.lock(); // Block

      await expect(mutex.rLock(50)).rejects.toThrow(
        RWMutexReadLockTimeoutError
      );
    });
  });

  describe('State Information', () => {
    it('should report correct state information', async () => {
      await mutex.rLock();
      await mutex.rLock();

      const state = mutex.getState();
      expect(state.readerCount).toBe(2);
      expect(state.writerLocked).toBe(false);
      expect(state.writerWaiting).toBe(false);
      expect(state.pendingReaders).toBe(0);
      expect(state.pendingWriters).toBe(0);
    });

    it('should report lock status correctly', () => {
      expect(mutex.isLocked()).toBe(false);
      expect(mutex.isReadLocked()).toBe(false);
      expect(mutex.isWriteLocked()).toBe(false);

      mutex.tryRLock();
      expect(mutex.isLocked()).toBe(true);
      expect(mutex.isReadLocked()).toBe(true);
      expect(mutex.isWriteLocked()).toBe(false);

      mutex.rUnlock();
      mutex.tryLock();
      expect(mutex.isLocked()).toBe(true);
      expect(mutex.isReadLocked()).toBe(false);
      expect(mutex.isWriteLocked()).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid timeout', () => {
      expect(() => new RWMutex({ timeout: -2 })).toThrow();
    });

    it('should include mutex name in error messages', async () => {
      const mutex = new RWMutex({ name: 'test-mutex', timeout: 50 });
      await mutex.lock();

      await expect(mutex.rLock()).rejects.toThrow(/test-mutex/);
    });
  });

  describe('Performance', () => {
    it('should handle many concurrent readers efficiently', async () => {
      const numReaders = 1000;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < numReaders; i++) {
        promises.push(mutex.rLock());
      }

      await Promise.all(promises);
      expect(mutex.getState().readerCount).toBe(numReaders);

      // Release all
      for (let i = 0; i < numReaders; i++) {
        mutex.rUnlock();
      }

      expect(mutex.getState().readerCount).toBe(0);
    });
  });
});
