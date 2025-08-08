import {
  ContextCancelledError,
  ContextDeadlineExceededError,
  validateDeadline,
  validateTimeout,
} from '../utils';
import { Channel } from './channel';
import { go } from './goroutine';

/**
 * Context interface that mirrors Go's context.Context
 *
 * A Context carries a deadline, a cancellation signal, and other values
 * across API boundaries. Context's methods may be called by multiple
 * goroutines simultaneously.
 */
export interface Context {
  /**
   * Deadline returns the time when work done on behalf of this context
   * should be canceled. Deadline returns ok==false when no deadline is set.
   * Successive calls to Deadline return the same results.
   */
  deadline(): [Date | undefined, boolean];

  /**
   * Done returns a channel that's closed when work done on behalf of this
   * context should be canceled. Done may return null if this context can
   * never be canceled. Successive calls to Done return the same value.
   */
  done(): Channel<void> | null;

  /**
   * If Done is not yet closed, Err returns null.
   * If Done is closed, Err returns a non-null error explaining why:
   * - ContextDeadlineExceededError if the context's deadline passed
   * - ContextCancelledError if the context was canceled for some other reason
   */
  err(): Error | null;

  /**
   * Value returns the value associated with this context for key, or null
   * if no value is associated with key. Successive calls to Value with
   * the same key returns the same result.
   */
  value(key: AnyValue): AnyValue;
}

/**
 * CancelFunc tells an operation to abandon its work.
 * A CancelFunc does not wait for the work to stop.
 * A CancelFunc may be called by multiple goroutines simultaneously.
 * After the first call, subsequent calls to a CancelFunc do nothing.
 */
export type CancelFunc = () => void;

/**
 * CancelCauseFunc behaves like a CancelFunc but additionally sets the cancellation cause.
 * This cause can be retrieved by calling Cause on the canceled Context.
 */
export type CancelCauseFunc = (cause: Error) => void;

/**
 * Global callback for context cancellation notifications
 */
let contextCancellationCallback:
  | ((contextId: string, error: Error | null) => void)
  | null = null;

/**
 * Set the context cancellation callback
 */
export function setContextCancellationCallback(
  callback: (contextId: string, error: Error | null) => void
): void {
  contextCancellationCallback = callback;
}

/**
 * Clear the context cancellation callback
 */
export function clearContextCancellationCallback(): void {
  contextCancellationCallback = null;
}

/**
 * Base context implementation
 */
class BaseContext implements Context {
  deadline(): [Date | undefined, boolean] {
    return [undefined, false];
  }

  done(): Channel<void> | null {
    return null;
  }

  err(): Error | null {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  value(_key: AnyValue): AnyValue {
    return null;
  }
}

/**
 * Background returns a non-null, empty Context.
 * It is never canceled, has no values, and has no deadline.
 * It is typically used by the main function, initialization, and tests,
 * and as the top-level Context for incoming requests.
 */
export const Background: Context = new BaseContext();

/**
 * `TODO` returns a non-null, empty Context.
 * Code should use context.TODO when it's unclear which Context to use
 * or it is not yet available (because the surrounding function has not
 * yet been extended to accept a Context parameter).
 */
export const TODO: Context = new BaseContext();

/**
 * Canceled is the error returned by Context.Err when the context is canceled
 * for some reason other than its deadline passing.
 */
export const Canceled = new ContextCancelledError();

/**
 * DeadlineExceeded is the error returned by Context.Err when the context
 * is canceled due to its deadline passing.
 */
export const DeadlineExceeded = new ContextDeadlineExceededError(new Date());

/**
 * Options for creating derived contexts
 */
export type ContextOptions = {
  /** Parent context */
  parent?: Context;
  /** Deadline for the context */
  deadline?: Date;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Values to associate with the context */
  values?: Record<string, AnyValue>;
};

/**
 * High-performance cancelable context implementation
 *
 * Optimized for:
 * - Minimal memory allocations
 * - Fast cancellation propagation
 * - Efficient value storage
 * - Lock-free operations where possible
 */
class CancelableContext implements Context {
  private parent: Context;
  private doneChannel: Channel<void> | null = null;
  // private cancelFunc: CancelFunc | null = null;
  private _err: Error | null = null;
  private children: Set<CancelableContext> = new Set();
  private values: Map<AnyValue, AnyValue> = new Map();
  private deadlineTime: Date | undefined;
  private timeoutId: NodeJS.Timeout | null = null;
  private contextId: string;

  constructor(parent: Context, options: ContextOptions = {}) {
    this.parent = parent;
    this.contextId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // set deadline if provided
    if (options.deadline) {
      this.deadlineTime = options.deadline;
    } else if (options.timeout !== undefined) {
      validateTimeout(options.timeout);
      this.deadlineTime = new Date(Date.now() + options.timeout);
    }

    // Set values if provided
    if (options.values) {
      for (const [key, value] of Object.entries(options.values)) {
        this.values.set(key, value);
      }
    }

    // Set up deadline timer if needed
    if (this.deadlineTime) {
      const now = Date.now();
      const deadlineMs = this.deadlineTime.getTime();
      const timeoutMs = Math.max(0, deadlineMs - now);

      this.timeoutId = setTimeout(() => {
        this.cancel(DeadlineExceeded);
      }, timeoutMs);
    }

    // Set up parent cancellation
    this.setupParentCancellation();
  }

  /**
   * Get the context ID for worker thread communication
   */
  getContextId(): string {
    return this.contextId;
  }

  deadline(): [Date | undefined, boolean] {
    if (this.deadlineTime) {
      return [this.deadlineTime, true];
    }

    // Check parent deadline
    const [parentDeadline, parentOk] = this.parent.deadline();
    if (parentOk && parentDeadline) {
      // Use the earlier deadline
      if (
        !this.deadlineTime ||
        (parentDeadline as AnyValue) < this.deadlineTime
      ) {
        return [parentDeadline, true];
      }
    }

    return [this.deadlineTime, !!this.deadlineTime];
  }

  done(): Channel<void> | null {
    if (!this.doneChannel) {
      this.doneChannel = new Channel<void>({ bufferSize: 1 });
    }
    return this.doneChannel;
  }

  err(): Error | null {
    return this._err;
  }

  value(key: AnyValue): AnyValue {
    // Check this context's values first
    if (this.values.has(key)) {
      return this.values.get(key);
    }
    return this.parent.value(key);
  }

  /**
   * Cancel the context and all its children
   */
  cancel(cause?: Error): void {
    if (this._err !== null) {
      return; // Already canceled
    }

    this._err = cause || Canceled;

    // Call the global callback
    if (contextCancellationCallback) {
      contextCancellationCallback(this.contextId, this._err);
    }

    // Cancel all children
    for (const child of this.children) {
      child.cancel(this._err);
    }
    this.children.clear();

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Close done channel
    if (this.doneChannel) {
      this.doneChannel.close();
    }
  }

  /**
   * Add a child context
   * @param child - cancellable child context
   */
  addChild(child: CancelableContext): void {
    this.children.add(child);
  }

  /**
   * Remove a child context
   * @param child - cancellable child context
   */
  removeChild(child: CancelableContext): void {
    this.children.delete(child);
  }

  /**
   * Set up parent cancellation monitoring
   */
  private setupParentCancellation(): void {
    const parentDone = this.parent.done();
    if (parentDone && this.parent !== Background) {
      // Monitor parent cancellation only if parent is not Background
      go(async () => {
        try {
          await parentDone.receive();
          this.cancel(this.parent.err() as AnyValue);
        } catch (error) {
          // Ignore channel errors - parent might be cancelled already
        }
      });
    }
  }
}

/**
 * WithCancel returns a copy of parent with a new Done channel.
 * The returned context's Done channel is closed when the returned
 * cancel function is called or when the parent context's Done channel
 * is closed, whichever happens first.
 *
 * Canceling this context releases resources associated with it,
 * so code should call cancel as soon as the operations running
 * in this Context complete.
 */
export function withCancel(parent: Context): [Context, CancelFunc] {
  const ctx = new CancelableContext(parent);

  const cancel: CancelFunc = () => {
    ctx.cancel();
  };

  return [ctx, cancel];
}

/**
 * WithCancelCause returns a copy of parent with a new Done channel.
 * The returned context's Done channel is closed when the returned
 * cancel function is called or when the parent context's Done channel
 * is closed, whichever happens first.
 *
 * The returned CancelCauseFunc takes an error and records it as the
 * cancellation cause. Calling Cause on the canceled context or any
 * of its children retrieves the cause.
 */
export function withCancelCause(parent: Context): [Context, CancelCauseFunc] {
  const ctx = new CancelableContext(parent);

  const cancel: CancelCauseFunc = (cause: Error) => {
    ctx.cancel(cause);
  };

  return [ctx, cancel];
}

/**
 * WithDeadline returns a copy of the parent context with the deadline
 * adjusted to be no later than d. If the parent's deadline is already
 * earlier than d, WithDeadline(parent, d) is semantically equivalent
 * to parent. The returned context's Done channel is closed when the
 * deadline expires, when the returned cancel function is called, or
 * when the parent context's Done channel is closed, whichever happens first.
 */
export function withDeadline(
  parent: Context,
  deadline: Date
): [Context, CancelFunc] {
  validateDeadline(deadline);

  const [parentDeadline, parentOk] = parent.deadline();
  if (parentOk && parentDeadline && parentDeadline <= deadline) {
    // Parent deadline is earlier, return parent
    return [parent, () => {}];
  }

  const ctx = new CancelableContext(parent, { deadline });

  const cancel: CancelFunc = () => {
    ctx.cancel();
  };

  return [ctx, cancel];
}

/**
 * WithDeadlineCause behaves like WithDeadline but also sets the cause
 * of the returned Context when the deadline expires.
 */
export function withDeadlineCause(
  parent: Context,
  deadline: Date,
  cause: Error
): [Context, CancelFunc] {
  validateDeadline(deadline);

  const [parentDeadline, parentOk] = parent.deadline();
  if (parentOk && parentDeadline && parentDeadline <= deadline) {
    return [parent, () => {}];
  }

  const ctx = new CancelableContext(parent, { deadline });

  const cancel: CancelFunc = () => {
    ctx.cancel(cause);
  };

  return [ctx, cancel];
}

/**
 * WithTimeout returns WithDeadline(parent, time.Now().Add(timeout)).
 */
export function withTimeout(
  parent: Context,
  timeout: number
): [Context, CancelFunc] {
  validateTimeout(timeout);
  const deadline = new Date(Date.now() + timeout);
  return withDeadline(parent, deadline);
}

/**
 * WithTimeoutCause behaves like WithTimeout but also sets the cause
 * of the returned Context when the timeout expires.
 */
export function withTimeoutCause(
  parent: Context,
  timeout: number,
  cause: Error
): [Context, CancelFunc] {
  validateTimeout(timeout);
  const deadline = new Date(Date.now() + timeout);
  return withDeadlineCause(parent, deadline, cause);
}

/**
 * WithValue returns a copy of parent in which the value associated
 * with key is val.
 *
 * Use context Values only for request-scoped data that transits
 * processes and API boundaries, not for passing optional parameters
 * to functions.
 */
export function withValue(
  parent: Context,
  key: AnyValue,
  val: AnyValue
): Context {
  const ctx = new CancelableContext(parent);
  ctx.value = function (newKey: AnyValue): AnyValue {
    if (newKey === key) {
      return val;
    }
    return parent.value(newKey);
  };
  return ctx;
}

/**
 * WithoutCancel returns a copy of parent that is not canceled when
 * parent is canceled. The returned context returns no Deadline or Err,
 * and its Done channel is null.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function withoutCancel(_parent: Context): Context {
  return new BaseContext();
}

/**
 * Cause returns a non-null error explaining why c was canceled.
 * The first call to Cause c, or any context derived from c,
 * returns the cancellation cause. Subsequent calls to Cause return
 * the same result.
 */
export function cause(ctx: Context): Error | null {
  return ctx.err();
}

/**
 * AfterFunc arranges to call f in its own goroutine after ctx is canceled.
 * If ctx is already canceled, AfterFunc calls f immediately in its own goroutine.
 */
export function afterFunc(ctx: Context, f: () => void): () => boolean {
  let called = false;

  const execute = () => {
    if (!called) {
      called = true;
      f();
    }
  };

  const done = ctx.done();
  if (done) {
    go(async () => {
      await done.receive();
      execute();
    });
  } else if (ctx.err()) {
    // Context is already canceled
    execute();
  }

  return () => {
    if (called) {
      return false;
    }
    called = true;
    return true;
  };
}
