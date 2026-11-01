import { RUN_LIMITS } from '@shared/agent/runLimitSettings';
import type { RunModel } from '@shared/types/agentConversation';
import type { RunRetry } from '@/stores/runStore';
import { readStepWords } from '../run-view/stepWords';
import type { QuotedWords } from './noticeWords';
import { formatWho, quoteProviderError, readRunSource, type ServerAddresses } from './runSource';

/*
 * What the pane says while a request waits to go again. There is nothing to do, so these are
 * facts: what happened, when it tries next, and where that leaves the step it was on.
 */

type RetryKind = 'lost' | 'slow';

export interface RetryWords {
  tag: string;
  who: string;
  sentence: string;
  quoted: QuotedWords | null;
  note: string | null;
}

const readRetryKind = ({ error }: RunRetry): RetryKind =>
  error.reason === 'rateLimited' ? 'slow' : 'lost';

/** "The server" starts a sentence; mid-sentence it is "the server". */
const midSentence = (provider: string) => provider.replace(/^The /, 'the ');

const KIND_WORDS: Record<RetryKind, { tag: string; sentence: (provider: string) => string }> = {
  lost: {
    tag: 'Retrying',
    sentence: (provider) => `Lost the connection to ${midSentence(provider)}.`,
  },
  slow: { tag: 'Waiting', sentence: (provider) => `${provider} asked us to slow down.` },
};

/** Only a lost connection counts its tries: a rate limit waits the time it was given. */
const AFTER_COUNTDOWN: Record<RetryKind, (attempt: number) => string> = {
  lost: (attempt) => ` (${attempt} of ${RUN_LIMITS.retryWaitsMs.length}).`,
  slow: () => '.',
};

/** What the wait means for the step, beside the row it is about. */
function describeStepInRetry(retry: RunRetry): string | null {
  const call = retry.newestCall;
  if (call?.status === 'waiting') {
    return 'The step it was writing isn’t made yet. It starts that step again.';
  }
  if (call?.status !== 'done') return null;
  const kept = `${readStepWords(call.name).done(call.target)} is done and kept.`;
  return readRetryKind(retry) === 'lost' ? `${kept} It isn’t run again.` : kept;
}

export function describeRetry(
  retry: RunRetry,
  runModel: RunModel | null,
  serverAddresses: ServerAddresses
): RetryWords {
  const source = readRunSource(runModel, serverAddresses);
  const words = KIND_WORDS[readRetryKind(retry)];
  return {
    tag: words.tag,
    who: formatWho(source),
    sentence: words.sentence(source.provider),
    quoted: quoteProviderError(retry.error, source.provider),
    note: describeStepInRetry(retry),
  };
}

/** The whole seconds left in the wait; zero or less once it is over. */
export const readSecondsLeft = ({ since, waitMs }: RunRetry, now: number) =>
  Math.ceil((since + waitMs - now) / 1000);

/** "Trying again in 3 s (2 of 3)." */
export function formatRetryCountdown(retry: RunRetry, secondsLeft: number): string {
  const when = secondsLeft > 0 ? `in ${secondsLeft} s` : 'now';
  return `Trying again ${when}${AFTER_COUNTDOWN[readRetryKind(retry)](retry.attempt)}`;
}
