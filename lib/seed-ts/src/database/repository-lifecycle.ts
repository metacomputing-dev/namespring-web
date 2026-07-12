/**
 * Await one repository I/O step while preserving the close() generation
 * contract. If the operation and close race, cancellation wins; otherwise the
 * original operation error is preserved.
 */
export async function awaitActiveRepositoryStep<T>(
  operation: () => Promise<T>,
  assertActive: () => void,
): Promise<T> {
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
