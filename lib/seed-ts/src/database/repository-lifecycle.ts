/**
 * Await one repository I/O step while preserving the close() generation
 * contract. If the operation and close race, cancellation wins; otherwise the
 * original operation error is preserved. An optional repository-owned signal
 * also settles cancellation when an injected transport ignores abort, while
 * attached promise handlers consume any late resolution or rejection.
 */
export async function awaitActiveRepositoryStep<T>(
  operation: () => Promise<T>,
  assertActive: () => void,
  signal?: AbortSignal,
): Promise<T> {
  if (signal) {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let abortListenerAttached = false;

      const removeAbortListener = (): void => {
        if (!abortListenerAttached) return;
        abortListenerAttached = false;
        signal.removeEventListener('abort', onAbort);
      };
      const rejectAsCancellation = (): void => {
        if (settled) return;
        settled = true;
        removeAbortListener();
        try {
          assertActive();
        } catch (error) {
          reject(error);
          return;
        }
        reject(signal.reason ?? new Error('Repository operation was aborted.'));
      };
      const onAbort = (): void => rejectAsCancellation();
      const resolveOperation = (value: T): void => {
        if (settled) return;
        settled = true;
        removeAbortListener();
        try {
          assertActive();
          resolve(value);
        } catch (error) {
          reject(error);
        }
      };
      const rejectOperation = (error: unknown): void => {
        if (settled) return;
        settled = true;
        removeAbortListener();
        try {
          assertActive();
          reject(error);
        } catch (cancellationError) {
          reject(cancellationError);
        }
      };

      if (signal.aborted) {
        rejectAsCancellation();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      abortListenerAttached = true;
      if (settled) {
        removeAbortListener();
        return;
      }
      if (signal.aborted) {
        rejectAsCancellation();
        return;
      }

      let operationPromise: Promise<T>;
      try {
        operationPromise = Promise.resolve(operation());
      } catch (error) {
        rejectOperation(error);
        return;
      }
      // Both handlers stay attached after cancellation so a transport that
      // ignores AbortSignal cannot create an unhandled late rejection.
      operationPromise.then(resolveOperation, rejectOperation);
    });
  }

  let value: T;
  try {
    value = await operation();
  } catch (error) {
    assertActive();
    throw error;
  }
  assertActive();
  return value;
}
