/**
 * A read whose failure is an answer like any other: a failed list, an empty one. The failure
 * is logged here, so the screens showing the answer have one case to handle. An action the
 * user started rejects instead, and the screen says what went wrong.
 */
export async function readOr<T>(
  read: () => Promise<T>,
  whenFailed: T,
  failure: string
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(failure, error);
    return whenFailed;
  }
}
