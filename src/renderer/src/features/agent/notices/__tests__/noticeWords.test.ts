import { describe, expect, it } from 'vitest';
import type { AgentStartRefusal } from '@shared/types/agentBridge';
import type { RunStopReason, RunStoppedMessageBody } from '@shared/types/agentConversation';
import type { ModelProviderError } from '@shared/types/modelReply';
import type { NoticeWords } from '../noticeWords';
import { describeStartRefusal } from '../startRefusalWords';
import { describeStop, findKeySavedSince } from '../stopWords';

const dated = (savedAt: number) => ({ where: 'keychain' as const, savedAt, checkedAt: savedAt });
const ANTHROPIC = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
const OLLAMA = { provider: 'ollama', model: 'llama3.1:8b' };
const ADDRESS = 'http://localhost:11434';

const PROVIDER_ERRORS: Record<ModelProviderError['reason'], ModelProviderError> = {
  unreachable: { reason: 'unreachable', message: 'connect ECONNREFUSED 127.0.0.1:11434' },
  rateLimited: { reason: 'rateLimited', httpStatus: 429, message: 'Rate limit reached' },
  keyRefused: { reason: 'keyRefused', httpStatus: 401, message: 'invalid x-api-key' },
  quotaExceeded: { reason: 'quotaExceeded', httpStatus: 402, message: 'More credits needed' },
  'model-not-found': { reason: 'model-not-found', httpStatus: 404, message: 'not found' },
  toolsUnsupported: { reason: 'toolsUnsupported', httpStatus: 404, message: 'No tool use' },
  contentBlocked: { reason: 'contentBlocked', message: 'finishReason: SAFETY' },
  'context-too-long': { reason: 'context-too-long', httpStatus: 400, message: 'too long' },
  failed: { reason: 'failed', httpStatus: 400, message: 'INVALID_ARGUMENT' },
};

/** Every stop a run can store: each stop layer, and each provider error both ways it comes. */
function listStops(): RunStoppedMessageBody[] {
  const own: RunStopReason[] = ['repeatedCall', 'refusalsInARow', 'stepLimit', 'appFault'];
  return [
    ...own.map((reason) => ({ type: 'runStopped', reason, detail: 'Outside this turn.' }) as const),
    ...Object.values(PROVIDER_ERRORS).flatMap((providerError) =>
      (['connection', 'providerError'] as const).map((reason) => ({
        type: 'runStopped' as const,
        reason,
        providerError,
        attempts: 4,
        waitedMs: 21_000,
      }))
    ),
  ];
}

const allWords = (words: NoticeWords) => [
  words.who,
  words.sentence,
  words.did ?? '',
  ...words.actions.map((action) => ('label' in action ? action.label : action.command)),
];

describe('what each notice says', () => {
  it('gives every stop and refusal a sentence and a way forward, in Mosaic’s words', () => {
    const notices: NoticeWords[] = [
      ...listStops().flatMap((stop) =>
        [ANTHROPIC, OLLAMA].map((model) => describeStop(stop, model, ADDRESS)!)
      ),
      ...(['noApiKey', 'keychainRefused', 'runInProgress', 'assistantOff'] as const).map(
        (refusal: AgentStartRefusal) =>
          describeStartRefusal(refusal, { providerLabel: 'Anthropic', model: 'claude-sonnet-5-5' })
      ),
    ];
    for (const words of notices) {
      expect(words.sentence).not.toBe('');
      expect(words.actions.length).toBeGreaterThan(0);
      for (const text of allWords(words)) expect(text).not.toMatch(/—/);
    }
  });

  it('leaves the user’s own Stop to the run, not a notice', () => {
    expect(
      describeStop({ type: 'runStopped', reason: 'cancelled' }, ANTHROPIC, ADDRESS)
    ).toBeNull();
  });

  it('names who failed, quotes them as they came, and says what was tried', () => {
    const reach = describeStop(
      {
        type: 'runStopped',
        reason: 'connection',
        providerError: PROVIDER_ERRORS.unreachable,
        attempts: 4,
        waitedMs: 21_000,
      },
      OLLAMA,
      ADDRESS
    );
    expect(reach).toMatchObject({
      level: 'cantRun',
      who: 'Ollama · llama3.1:8b · localhost:11434',
      sentence: 'Couldn’t reach Ollama at localhost:11434. Check that it’s running.',
      record: 'Couldn’t reach Ollama',
      quoted: { label: 'Your computer said', code: null },
      did: 'Tried 4 times.',
      actions: [{ kind: 'command', command: 'ollama serve' }, { kind: 'again' }],
    });

    const credits = describeStop(
      { type: 'runStopped', reason: 'providerError', providerError: PROVIDER_ERRORS.quotaExceeded },
      { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
      ADDRESS
    );
    expect(credits).toMatchObject({
      sentence: 'Your OpenRouter account is out of credits or over its quota.',
      quoted: { label: 'OpenRouter said', code: '402', text: 'More credits needed' },
      actions: [
        { kind: 'link', label: 'Billing page', url: 'https://openrouter.ai/settings/credits' },
        { kind: 'again' },
      ],
    });
  });

  it('says so when a new key was saved after a refusal, and leads with sending again', () => {
    const stop: RunStoppedMessageBody = {
      type: 'runStopped',
      reason: 'providerError',
      providerError: PROVIDER_ERRORS.keyRefused,
    };
    const stopped = { model: ANTHROPIC, stoppedAt: 1_000 };
    const savedAt = new Date(2026, 9, 29, 14, 6).getTime();

    expect(findKeySavedSince(stopped, { anthropic: dated(500) })).toBeNull();
    expect(findKeySavedSince(stopped, { openai: dated(savedAt) })).toBeNull();
    expect(findKeySavedSince(stopped, { anthropic: dated(savedAt) })).toBe(savedAt);

    expect(describeStop(stop, ANTHROPIC, ADDRESS)).toMatchObject({
      did: 'Used the API key you saved in Settings.',
      actions: [{ kind: 'settings' }, { kind: 'link' }, { kind: 'again' }],
    });
    const words = describeStop(stop, ANTHROPIC, ADDRESS, savedAt);
    expect(words?.did).toMatch(/^New key saved at .+\.$/);
    expect(words?.actions).toMatchObject([
      { kind: 'again', isPrimary: true },
      { kind: 'settings' },
      { kind: 'link' },
    ]);
  });

  it('says the limit a stop layer counted to, and why Mosaic refused', () => {
    const repeating = describeStop(
      { type: 'runStopped', reason: 'repeatedCall', detail: 'Outside this turn.' },
      ANTHROPIC,
      ADDRESS
    );
    expect(repeating).toMatchObject({
      level: 'stopped',
      did: 'Refused 3 times.',
      quoted: { label: 'Why Mosaic refused it', text: 'Outside this turn.' },
    });
    expect(
      describeStop({ type: 'runStopped', reason: 'stepLimit' }, ANTHROPIC, ADDRESS)
    ).toMatchObject({ sentence: 'Stopped after 40 steps without finishing.', quoted: null });
  });
});
