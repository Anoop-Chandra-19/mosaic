import type { NoticeRefusal, NoticeResend, NoticeSource } from '@/stores/agentNoticeStore';
import type { RunView } from '@/types/agentRunView';
import type { AgentStartRefusal } from '@shared/types/agentBridge';
import { formatNoticeTime, type NoticeWords } from './noticeWords';
import { formatCheckedAgain } from './startRefusalWords';
import { formatSentAgain } from './stopWords';

/*
 * Which notice the slot over the prompt box shows: one at a time. A message main wouldn't
 * start comes first; then the open conversation's last run, if it stopped and nothing has
 * started since. A send made while a notice showed keeps it, sending, until the answer:
 * gone once the new run gets going, in place with the time when it stops the same way,
 * or swapped for another. `sendMessage` ends the wait for a run that stays silent, and a
 * later stop of that run is a notice of its own.
 */

export interface ShownNotice {
  source: NoticeSource;
  words: NoticeWords;
  /** The same through a same answer, so the notice pulses in place rather than rising again. */
  key: string;
  isSending: boolean;
  /** When a send came back with the same answer. */
  checked: string | null;
  /** Changes with each same answer, for the pulse. */
  pulseKey: number;
}

export interface NoticeChoice {
  notice: ShownNotice | null;
  /** For screen readers: how a send made while a notice showed went. */
  announcement: string;
}

/** The open conversation's run under way, or just ended and not yet read back. */
export interface LiveRunFacts {
  runId: number;
  /** It has written something, so the request got through. */
  hasProgress: boolean;
  hasEnded: boolean;
}

export interface NoticeFacts {
  conversationId: number | null;
  /** The open conversation's stored runs, oldest first. */
  runs: RunView[];
  live: LiveRunFacts | null;
  refusal: NoticeRefusal | null;
  resend: NoticeResend | null;
  dismissedRunIds: number[];
  describeRun: (run: RunView) => NoticeWords | null;
  describeRefusal: (reason: AgentStartRefusal) => NoticeWords;
}

const NONE: NoticeChoice = { notice: null, announcement: '' };

const showWords = (source: NoticeSource, words: NoticeWords): ShownNotice => ({
  source,
  words,
  key: words.kind,
  isSending: false,
  checked: null,
  pulseKey: 0,
});

function showRun(facts: NoticeFacts, run: RunView | undefined): ShownNotice | null {
  if (!run || facts.dismissedRunIds.includes(run.runId)) return null;
  const words = facts.describeRun(run);
  return words && showWords({ type: 'run', runId: run.runId }, words);
}

function showSource(facts: NoticeFacts, source: NoticeSource): ShownNotice | null {
  if (source.type === 'refusal') return showWords(source, facts.describeRefusal(source.reason));
  return showRun(
    facts,
    facts.runs.find((run) => run.runId === source.runId)
  );
}

function showRefusal(facts: NoticeFacts, refusal: NoticeRefusal): NoticeChoice {
  const notice = showWords(
    { type: 'refusal', reason: refusal.reason },
    facts.describeRefusal(refusal.reason)
  );
  if (refusal.checkedAt === null) return { notice, announcement: '' };
  return {
    notice: {
      ...notice,
      checked: formatCheckedAgain(formatNoticeTime(refusal.checkedAt)),
      pulseKey: refusal.checkedAt,
    },
    announcement: 'Same answer.',
  };
}

/** The last run's stop, unless a newer run has started. */
function showLastStop(facts: NoticeFacts): NoticeChoice {
  const last = facts.runs.at(-1);
  if (facts.live && facts.live.runId !== last?.runId) return NONE;
  return { notice: showRun(facts, last), announcement: '' };
}

/** How a send made while a notice showed went; null once it is a run like any other. */
function answerResend(facts: NoticeFacts, resend: NoticeResend): NoticeChoice | null {
  const before = showSource(facts, resend.from);
  const sending = { notice: before && { ...before, isSending: true }, announcement: '' };
  if (resend.runId === null) return sending;

  const live = facts.live?.runId === resend.runId ? facts.live : null;
  if (live?.hasProgress) return { notice: null, announcement: 'Sent.' };
  const run = facts.runs.find((each) => each.runId === resend.runId);
  if ((live && !live.hasEnded) || !run) return sending;
  if (run.parts.length > 0) return null;

  const after = showRun(facts, run);
  if (!after) return { notice: null, announcement: 'Sent.' };
  if (after.words.kind !== before?.words.kind) return { notice: after, announcement: '' };
  return {
    notice: {
      ...after,
      checked: formatSentAgain(formatNoticeTime(resend.sentAt)),
      pulseKey: resend.sentAt,
    },
    announcement: 'Same answer.',
  };
}

export function pickNotice(facts: NoticeFacts): NoticeChoice {
  const isHere = (entry: { conversationId: number | null } | null) =>
    entry !== null && entry.conversationId === facts.conversationId;
  if (facts.refusal && isHere(facts.refusal)) return showRefusal(facts, facts.refusal);
  const answer = facts.resend && isHere(facts.resend) ? answerResend(facts, facts.resend) : null;
  return answer ?? showLastStop(facts);
}
