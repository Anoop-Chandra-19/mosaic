import { describe, expect, it } from 'vitest';
import type { RunStopReason, RunStoppedMessageBody } from '@shared/types/agentConversation';
import type { ModelProviderError } from '@shared/types/modelReply';
import { shortModelName } from '@/lib/shortModelName';
import type { NoticeWords } from '../noticeWords';
import { describeStartRefusal } from '../startRefusalWords';
import { describeStop, findKeySavedSince } from '../stopWords';

const dated = (savedAt: number) => ({ where: 'keychain' as const, savedAt, checkedAt: savedAt });
const ANTHROPIC = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
const OLLAMA = { provider: 'ollama', model: 'llama3.1:8b' };
const COMPATIBLE = { provider: 'openaiCompatible', model: 'local-model' };
const ADDRESSES = { ollama: 'http://localhost:11434', openaiCompatible: 'http://127.0.0.1:8080' };

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
        [ANTHROPIC, OLLAMA, COMPATIBLE].map((model) => describeStop(stop, model, ADDRESSES)!)
      ),
      ...(['noApiKey', 'keychainRefused', 'assistantOff'] as const).map((refusal) =>
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
      describeStop({ type: 'runStopped', reason: 'cancelled' }, ANTHROPIC, ADDRESSES)
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
      ADDRESSES
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
      ADDRESSES
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

    expect(describeStop(stop, ANTHROPIC, ADDRESSES)).toMatchObject({
      did: 'Used the API key you saved in Settings.',
      actions: [{ kind: 'settings' }, { kind: 'link' }, { kind: 'again' }],
    });
    const words = describeStop(stop, ANTHROPIC, ADDRESSES, savedAt);
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
      ADDRESSES
    );
    expect(repeating).toMatchObject({
      level: 'stopped',
      did: 'Refused 3 times.',
      quoted: { label: 'Why Mosaic refused it', text: 'Outside this turn.' },
    });
    expect(
      describeStop({ type: 'runStopped', reason: 'stepLimit' }, ANTHROPIC, ADDRESSES)
    ).toMatchObject({ sentence: 'Stopped after 40 steps without finishing.', quoted: null });
  });

  it.each<[ModelProviderError['reason'], object]>([
    [
      'unreachable',
      { sentence: 'Couldn’t reach the server at 127.0.0.1:8080. Check that it’s running.' },
    ],
    ['keyRefused', { sentence: expect.stringContaining('wants an API key') }],
    ['model-not-found', { sentence: 'The server has no model called local-model.' }],
    ['toolsUnsupported', { did: expect.stringContaining('--jinja') }],
    ['context-too-long', { did: expect.stringContaining('llama.cpp -c') }],
    ['failed', { sentence: 'The server refused the request.' }],
  ])('talks about the user’s own server when it answers %s', (reason, expected) => {
    const stop: RunStoppedMessageBody = {
      type: 'runStopped',
      reason: 'providerError',
      providerError: PROVIDER_ERRORS[reason],
    };
    expect(describeStop(stop, COMPATIBLE, ADDRESSES)).toMatchObject({
      who: 'OpenAI-compatible · local-model · 127.0.0.1:8080',
      ...expected,
    });
  });

  it('names a model loaded from a file by the file, and leaves other names whole', () => {
    expect(
      ['/models/qwen-Q4.gguf', 'C:\\models\\qwen-Q4.gguf', 'Qwen/Qwen3', 'qwen3.5:9b'].map(
        shortModelName
      )
    ).toEqual(['qwen-Q4.gguf', 'qwen-Q4.gguf', 'Qwen/Qwen3', 'qwen3.5:9b']);
  });

  it('quotes the server as the server, and offers no account pages', () => {
    const words = describeStop(
      { type: 'runStopped', reason: 'providerError', providerError: PROVIDER_ERRORS.failed },
      COMPATIBLE,
      ADDRESSES
    );
    expect(words?.quoted).toMatchObject({ label: 'The server said', code: '400' });
    expect(words?.actions).toEqual([expect.objectContaining({ kind: 'again' })]);
  });
});
