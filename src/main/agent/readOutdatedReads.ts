import type { Database } from 'better-sqlite3';
import { READ_TOOLS } from '@shared/agent-tools/readTools';
import type { OutdatedRead, ReadOutcome } from '@shared/types/agentBridge';
import { findTemplateRev } from '../db/conversations/runs';
import { readRunCallRows, type RunCallRow } from '../db/conversations/toolCalls';
import type { DraftStamp } from './assembleModelContext';

/*
 * What the Trace says of a read that no longer holds, by the rule the model is held to
 * (`assembleModelContext.ts`). Its context is built from the log every step, so a read goes
 * stale for the model the moment a step sees the draft elsewhere. That is on record as a later
 * run or call stamped differently. A read nothing later saw differently can still be out of date
 * against the draft as it is now. A rev never leaves main: only what became of each read does.
 */

const stampKey = (templateId: string | null, rev: number | null) => `${templateId} ${rev}`;

/** Where the draft stood each time the conversation looked, a read among them. */
interface Sighting {
  key: string;
  read: { runId: number; callId: string } | null;
}

function listSightings(rows: RunCallRow[]): Sighting[] {
  const sightings: Sighting[] = [];
  let lastRunId: number | null = null;
  for (const { runId, templateId, runRev, callId, name, status, callRev } of rows) {
    if (runId !== lastRunId) sightings.push({ key: stampKey(templateId, runRev), read: null });
    lastRunId = runId;
    if (callId === null) continue;
    const isAnsweredRead = name !== null && Object.hasOwn(READ_TOOLS, name) && status === 'ok';
    sightings.push({
      key: stampKey(templateId, callRev),
      read: isAnsweredRead ? { runId, callId } : null,
    });
  }
  return sightings;
}

function readAgainstDraft(key: string, draft: DraftStamp | null): ReadOutcome | null {
  if (draft === null || !key.startsWith(`${draft.templateId} `)) return 'otherResume';
  return key === stampKey(draft.templateId, draft.rev) ? null : 'edited';
}

export function findOutdatedReads(rows: RunCallRow[], draft: DraftStamp | null): OutdatedRead[] {
  const outdated: OutdatedRead[] = [];
  const seenLater = new Set<string>();
  for (const { key, read } of listSightings(rows).reverse()) {
    if (read) {
      const wasSeenElsewhere = seenLater.size > 1 || (seenLater.size === 1 && !seenLater.has(key));
      const outcome = wasSeenElsewhere ? 'askedAgain' : readAgainstDraft(key, draft);
      if (outcome) outdated.push({ ...read, outcome });
    }
    seenLater.add(key);
  }
  return outdated;
}

export function readOutdatedReads(
  db: Database,
  conversationId: number,
  templateId: string | null
): OutdatedRead[] {
  const rev = templateId === null ? undefined : findTemplateRev(db, templateId);
  const draft = templateId !== null && rev !== undefined ? { templateId, rev } : null;
  return findOutdatedReads(readRunCallRows(db, conversationId), draft);
}
