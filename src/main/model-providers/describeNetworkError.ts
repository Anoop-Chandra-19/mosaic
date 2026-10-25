/** What the network said when nothing answered: `fetch failed` hides it in its cause. */
export function describeNetworkError(error: unknown): string {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  return cause instanceof Error ? cause.message : String(cause);
}
