import { useEffect, useState } from 'react';
import { agentService } from '@/lib/services/agentService';
import { readOr } from '@/lib/services/readOr';
import { useConversationStore } from '@/stores/conversationStore';
import { useResumeStore } from '@/stores/resumeStore';
import type { OutdatedRead, ReadOutcome } from '@shared/types/agentBridge';

/** One run's reads that no longer hold, by call. */
export type ReadOutcomes = Record<string, ReadOutcome>;

function groupByRun(reads: OutdatedRead[]): Record<number, ReadOutcomes> {
  const byRun: Record<number, ReadOutcomes> = {};
  for (const { runId, callId, outcome } of reads) (byRun[runId] ??= {})[callId] = outcome;
  return byRun;
}

/**
 * Which reads no longer hold depends on the draft as it is now, so main is asked again when a
 * save moves it, another resume opens, or the log grows. A save, not an edit: main answers from
 * what it has stored, and a run stored the last time it heard.
 */
export function useOutdatedReads(): Record<number, ReadOutcomes> {
  const conversationId = useConversationStore((s) => s.conversationId);
  const newestId = useConversationStore((s) => (s.hasNewer ? s.lastRun : s.messages).at(-1)?.id);
  const templateId = useResumeStore((s) => s.templateId);
  const savedAt = useResumeStore((s) => s.savedAt);
  const [outcomes, setOutcomes] = useState<Record<number, ReadOutcomes>>({});

  useEffect(() => {
    if (conversationId === null) return;
    let isCurrent = true;
    void readOr(
      () => agentService.readOutdatedReads(conversationId, templateId),
      [],
      'Couldn’t read which reads are out of date'
    ).then((reads) => {
      if (isCurrent) setOutcomes(groupByRun(reads));
    });
    return () => {
      isCurrent = false;
    };
  }, [conversationId, newestId, templateId, savedAt]);

  return outcomes;
}
