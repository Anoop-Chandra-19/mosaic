/*
 * When a run stops on its own. A refused call the model then fixes is the loop working, so
 * errors as such never stop a run; a loop that isn't getting anywhere does, and so does a
 * connection that isn't there. Defaults, not settings, until the evals show a need. Main
 * counts against them (`runLimits.ts`); the pane says the numbers when a run stops.
 */
export const RUN_LIMITS = {
  /** The same call refused with the same answer: the 2nd time is warned, this one stops. */
  sameRefusalsBeforeStop: 3,
  /**
   * Steps whose calls were all refused, with nothing done between them. Counted by step,
   * not call: a step's calls are made together, before the model hears any answer.
   */
  refusedStepsInARow: 3,
  /** Tool rounds in one run. */
  steps: 40,
  /** A request that failed in a way worth trying again waits this long before each retry. */
  retryWaitsMs: [1000, 4000, 16_000],
  /** No stream data for this long counts as a failed request. */
  stallMs: 60_000,
  /** A tool the page doesn't answer in this long fails, and the run carries on. */
  toolAnswerMs: 10_000,
};

export type RunLimitSettings = typeof RUN_LIMITS;
