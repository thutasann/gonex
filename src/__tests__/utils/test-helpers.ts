export const createMockFunction = <T>(returnValue: T, delay = 0) => {
  return jest.fn().mockImplementation(() => {
    if (delay > 0) {
      return new Promise<T>(resolve =>
        setTimeout(() => resolve(returnValue), delay)
      );
    }
    return returnValue;
  });
};

export const createAsyncMock = <T>(returnValue: T, delay = 100) => {
  return jest
    .fn()
    .mockImplementation(
      () =>
        new Promise<T>(resolve => setTimeout(() => resolve(returnValue), delay))
    );
};

export const createErrorMock = (error: Error, delay = 100) => {
  return jest
    .fn()
    .mockImplementation(
      () =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(error), delay)
        )
    );
};

export const waitFor = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 100
) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
};

export const createTestError = (message: string, code?: string) => {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
};
