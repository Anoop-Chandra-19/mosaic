import { describe, expect, it } from 'vitest';
import type { NoticeResend } from '@/stores/agentNoticeStore';
import type { RunView } from '@/types/agentRunView';
import type { RunStopReason } from '@shared/types/agentConversation';
import type { NoticeWords } from '../noticeWords';
import { pickNotice, type NoticeFacts } from '../pickNotice';

const SENT_AT = new Date(2026, 9, 29, 14, 6).getTime();

const run = (runId: number, stop: RunStopReason | null, hasText = false): RunView => ({
  runId,
  model: { provider: 'anthropic', model: 'claude-sonnet-5-5' },
  startedAt: 0,
  ask: null,
  switchedTo: null,
  parts: hasText ? [{ type: 'text', text: 'Rewriting the Twilio bullet.' }] : [],
  stop: stop && { type: 'runStopped', reason: stop },
  stoppedAt: stop && 0,
});

const words = (kind: string): NoticeWords => ({
  kind,
  level: 'cantRun',
  who: 'Anthropic · claude-sonnet-5-5',
  sentence: kind,
  quoted: null,
  did: null,
  isKeptShown: true,
  actions: [{ kind: 'again', label: 'Send again' }],
});

const facts = (given: Partial<NoticeFacts>): NoticeFacts => ({
  conversationId: 1,
  runs: [],
  live: null,
  refusal: null,
  resend: null,
  dismissedRunIds: [],
  describeRun: (each) =>
    each.stop && each.stop.reason !== 'cancelled' ? words(each.stop.reason) : null,
  describeRefusal: (reason) => words(reason),
  ...given,
});

const resend = (runId: number | null): NoticeResend => ({
  conversationId: 1,
  from: { type: 'run', runId: 4 },
  sentAt: SENT_AT,
  runId,
});

const shownKind = (choice: ReturnType<typeof pickNotice>) => choice.notice?.words.kind ?? null;

describe('pickNotice', () => {
  it('shows the last run’s stop until it is dismissed or another run starts', () => {
    const runs = [run(3, 'stepLimit'), run(4, 'connection')];
    expect(shownKind(pickNotice(facts({ runs })))).toBe('connection');
    expect(pickNotice(facts({ runs, dismissedRunIds: [4] })).notice).toBeNull();
    expect(
      pickNotice(facts({ runs, live: { runId: 5, hasProgress: false, hasEnded: false } })).notice
    ).toBeNull();
    expect(pickNotice(facts({ runs: [run(3, 'stepLimit'), run(4, null)] })).notice).toBeNull();
    expect(pickNotice(facts({ runs: [run(4, 'cancelled')] })).notice).toBeNull();
  });

  it('keeps the notice, sending, until a send made while it showed is answered', () => {
    const runs = [run(4, 'providerError')];
    const pending = pickNotice(facts({ runs, resend: resend(null) })).notice;
    expect(pending).toMatchObject({ isSending: true, words: { kind: 'providerError' } });

    const started = pickNotice(
      facts({
        runs: [...runs, run(5, null)],
        resend: resend(5),
        live: { runId: 5, hasProgress: false, hasEnded: false },
      })
    );
    expect(started.notice).toMatchObject({ isSending: true, words: { kind: 'providerError' } });
  });

  it('folds away once the new run gets going, and says it was sent', () => {
    const live = { runId: 5, hasProgress: true, hasEnded: false };
    expect(pickNotice(facts({ runs: [run(4, 'providerError')], live, resend: resend(5) }))).toEqual(
      {
        notice: null,
        announcement: 'Sent.',
      }
    );
  });

  it('stays in place for the same answer, with the time, and swaps for another', () => {
    const same = pickNotice(
      facts({ runs: [run(4, 'providerError'), run(5, 'providerError')], resend: resend(5) })
    );
    expect(same.announcement).toBe('Same answer.');
    expect(same.notice).toMatchObject({
      source: { type: 'run', runId: 5 },
      key: 'providerError',
      isSending: false,
      pulseKey: SENT_AT,
    });
    expect(same.notice?.checked).toMatch(/^Sent again at .+\. Same answer\.$/);

    const other = pickNotice(
      facts({ runs: [run(4, 'providerError'), run(5, 'connection')], resend: resend(5) })
    );
    expect(other.notice).toMatchObject({ key: 'connection', checked: null, pulseKey: 0 });
  });

  it('treats a stop after the new run got going as a stop of its own', () => {
    const later = pickNotice(
      facts({ runs: [run(4, 'providerError'), run(5, 'providerError', true)], resend: resend(5) })
    );
    expect(later.notice).toMatchObject({ checked: null, pulseKey: 0 });
  });

  it('says a refusal that came back the same was checked again', () => {
    const choice = pickNotice(
      facts({
        runs: [run(4, 'providerError')],
        refusal: { conversationId: 1, reason: 'noApiKey', checkedAt: SENT_AT },
      })
    );
    expect(shownKind(choice)).toBe('noApiKey');
    expect(choice.notice?.checked).toMatch(/^Checked again at .+\. Same answer\.$/);
    expect(
      pickNotice(facts({ refusal: { conversationId: 2, reason: 'noApiKey', checkedAt: null } }))
        .notice
    ).toBeNull();
  });
});
