import type { ReadOutcome } from '@shared/types/agentBridge';
import type { StepRow, TimelineItem } from '../run-view/runTimeline';
import type { ReadOutcomes } from './useOutdatedReads';

/** A step worth a closer look: it didn't go as asked, took more than one try, or went stale. */
export function isStepFlagged(row: StepRow, readOutcome: ReadOutcome | undefined): boolean {
  const hasRetries = (row.call.request?.retries.length ?? 0) > 0;
  const didNotFinish = row.state === 'fail' || row.state === 'cut';
  return (
    didNotFinish || hasRetries || row.call.checkName !== undefined || readOutcome !== undefined
  );
}

export function countFlaggedSteps(
  timeline: TimelineItem[],
  readOutcomes: ReadOutcomes | undefined
): number {
  return timeline
    .flatMap((item) => (item.kind === 'line' ? item.line.steps : []))
    .filter((step) => isStepFlagged(step, readOutcomes?.[step.key])).length;
}
