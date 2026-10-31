import {
  BILLING_PAGE_URLS,
  KEY_PAGE_URLS,
  MODEL_PROVIDER_OPTIONS,
  STATUS_PAGE_URLS,
} from '@/features/settings/sections/ai/modelProviderOptions';
import { formatTimeOfDay } from '@shared/time/formatTime';
import { RUN_LIMITS } from '@shared/agent/runLimitSettings';
import type { RunModel, RunStoppedMessageBody } from '@shared/types/agentConversation';
import type { RunView } from '@/types/agentRunView';
import type { ModelProviderError } from '@shared/types/modelReply';
import { KEYED_PROVIDERS, type KeyedProvider, type SecretsStatus } from '@shared/types/secrets';
import type { NoticeAction, NoticeLevel, NoticeWords, QuotedWords } from './noticeWords';
import { shortModelName } from '../shortModelName';

/*
 * What the pane says about a run that stopped on its own, from the facts its stop stored:
 * the notice over the box, and the short record line the run keeps after the notice goes.
 * A stop is sorted into one kind of problem, and the words are per kind, never per case:
 * the provider's own message and status are quoted as they came. The key is never shown.
 */

type StopKind =
  | 'cantReach'
  | 'trouble'
  | 'keyRefused'
  | 'credits'
  | 'modelMissing'
  | 'noTools'
  | 'tooLong'
  | 'blocked'
  | 'refused'
  | 'repeating'
  | 'nothing'
  | 'steps'
  | 'fault';

export interface StopWords extends NoticeWords {
  /** What the run's record line says, after "Stopped: ". */
  record: string;
}

/** Where the servers the user runs listen, as Settings has them now. */
export interface ServerAddresses {
  ollama: string;
  openaiCompatible: string;
}

interface StopFacts {
  stop: RunStoppedMessageBody;
  /** The name a notice opens with: "OpenAI-compatible". */
  providerLabel: string;
  /** Who the sentences talk about: "OpenAI", or "The server". */
  provider: string;
  /** Null for a server the user runs, which has no account pages. */
  keyedProvider: KeyedProvider | null;
  isOllama: boolean;
  isOpenAiCompatible: boolean;
  model: string;
  /** Where a server the user runs listens, as the address line reads it; else null. */
  address: string | null;
  /** "Tried 4 times.", when the step was tried more than once. */
  tries: string | null;
  /** When a key was saved for this provider, if that came after the stop. */
  newKeySavedAt: number | null;
}

interface KindWords {
  sentence: string;
  record: string;
  did?: string | null;
  quoted?: QuotedWords | null;
  actions: NoticeAction[];
}

const LEVELS: Record<StopKind, NoticeLevel> = {
  cantReach: 'cantRun',
  keyRefused: 'cantRun',
  credits: 'cantRun',
  modelMissing: 'cantRun',
  noTools: 'cantRun',
  tooLong: 'cantRun',
  trouble: 'stopped',
  blocked: 'stopped',
  refused: 'stopped',
  repeating: 'stopped',
  nothing: 'stopped',
  steps: 'stopped',
  fault: 'stopped',
};

/** A `connection` stop is one of the first two: the rest come as `providerError`. */
const PROVIDER_ERROR_KINDS: Record<ModelProviderError['reason'], StopKind> = {
  unreachable: 'cantReach',
  rateLimited: 'trouble',
  keyRefused: 'keyRefused',
  quotaExceeded: 'credits',
  'model-not-found': 'modelMissing',
  toolsUnsupported: 'noTools',
  'context-too-long': 'tooLong',
  contentBlocked: 'blocked',
  failed: 'refused',
};

/** Stop reasons that aren't the provider's; `cancelled` is the user's own Stop, never a notice. */
const OWN_STOP_KINDS: Record<
  Exclude<RunStoppedMessageBody['reason'], 'connection' | 'providerError'>,
  StopKind | null
> = {
  repeatedCall: 'repeating',
  refusalsInARow: 'nothing',
  stepLimit: 'steps',
  appFault: 'fault',
  cancelled: null,
};

function readStopKind(stop: RunStoppedMessageBody): StopKind | null {
  if (stop.reason === 'connection') {
    return stop.providerError?.reason === 'unreachable' ? 'cantReach' : 'trouble';
  }
  if (stop.reason === 'providerError') {
    return stop.providerError ? PROVIDER_ERROR_KINDS[stop.providerError.reason] : 'refused';
  }
  return OWN_STOP_KINDS[stop.reason];
}

const again: NoticeAction = { kind: 'again', label: 'Send again' };
const settings = (label = 'Open Settings'): NoticeAction => ({ kind: 'settings', label });
const askAnotherWay: NoticeAction = { kind: 'ask', label: 'Ask another way' };

/** A link to one of the provider's own pages; Ollama has none. */
function providerPage(
  facts: StopFacts,
  label: string,
  urls: Record<KeyedProvider, string>
): NoticeAction[] {
  return facts.keyedProvider ? [{ kind: 'link', label, url: urls[facts.keyedProvider] }] : [];
}

/** What the provider said; for a connection that never got there, what your computer said. */
function quoteProvider({ stop, provider }: StopFacts): QuotedWords | null {
  const error = stop.providerError;
  if (!error?.message) return null;
  return {
    label: error.reason === 'unreachable' ? 'Your computer said' : `${provider} said`,
    code: error.httpStatus === undefined ? null : String(error.httpStatus),
    text: error.message,
  };
}

/** The refusal a stop layer counted, or Mosaic's own error, under its label. */
function quoteDetail({ stop }: StopFacts, label: string): QuotedWords | null {
  return stop.detail ? { label, code: null, text: stop.detail } : null;
}

const KIND_WORDS: Record<StopKind, (facts: StopFacts) => KindWords> = {
  cantReach: (facts) =>
    facts.isOllama
      ? {
          sentence: `Couldn’t reach Ollama at ${facts.address}. Check that it’s running.`,
          record: 'Couldn’t reach Ollama',
          did: facts.tries,
          actions: [{ kind: 'command', command: 'ollama serve' }, again],
        }
      : {
          sentence: [`Couldn’t reach ${facts.provider}.`, facts.tries, 'Check your connection.']
            .filter(Boolean)
            .join(' '),
          record: `Couldn’t reach ${facts.provider}`,
          actions: [
            { ...again, isPrimary: true },
            ...providerPage(facts, 'Status page', STATUS_PAGE_URLS),
          ],
        },
  trouble: (facts) => ({
    sentence: [`${facts.provider} isn’t answering properly.`, facts.tries]
      .filter(Boolean)
      .join(' '),
    record: `${facts.provider} isn’t answering properly`,
    actions: [
      { kind: 'again', label: 'Try again' },
      ...providerPage(facts, 'Status page', STATUS_PAGE_URLS),
    ],
  }),
  keyRefused: (facts) => ({
    sentence: `${facts.provider} didn’t accept your API key.`,
    record: `${facts.provider} didn’t accept your API key`,
    ...(facts.newKeySavedAt === null
      ? {
          did: 'Used the API key you saved in Settings.',
          actions: [settings(), ...providerPage(facts, 'Keys page', KEY_PAGE_URLS), again],
        }
      : {
          did: `New key saved at ${formatTimeOfDay(facts.newKeySavedAt)}.`,
          actions: [
            { ...again, isPrimary: true },
            settings(),
            ...providerPage(facts, 'Keys page', KEY_PAGE_URLS),
          ],
        }),
  }),
  credits: (facts) => ({
    sentence: `Your ${facts.provider} account is out of credits or over its quota.`,
    record: `${facts.provider} account out of credits`,
    did: 'Not retried: waiting doesn’t help with this one.',
    actions: [...providerPage(facts, 'Billing page', BILLING_PAGE_URLS), again],
  }),
  modelMissing: (facts) =>
    facts.isOllama
      ? {
          sentence: `${facts.model} isn’t pulled in Ollama.`,
          record: `${facts.model} isn’t pulled`,
          actions: [{ kind: 'command', command: `ollama pull ${facts.model}` }, again],
        }
      : {
          sentence: `${facts.provider} has no model called ${facts.model}.`,
          record: `No model called ${facts.model}`,
          actions: [settings('Choose a model'), again],
        },
  noTools: (facts) => ({
    sentence: `${facts.model} can’t use tools, and the assistant needs them. Choose another model.`,
    record: `${facts.model} can’t use tools`,
    actions: [settings('Choose a model'), again],
  }),
  tooLong: (facts) => ({
    sentence: `This conversation is too long for ${facts.model}.`,
    record: `Too long for ${facts.model}`,
    actions: [
      { kind: 'newConversation', label: 'New conversation' },
      ...(facts.isOllama ? [settings('Raise the context window')] : []),
    ],
  }),
  blocked: (facts) => ({
    sentence: `${facts.provider} blocked this request.`,
    record: `${facts.provider} blocked this request`,
    actions: [askAnotherWay],
  }),
  refused: (facts) => ({
    sentence: `${facts.provider} refused the request.`,
    record: `${facts.provider} refused the request`,
    actions: [{ ...again, isPrimary: true }],
  }),
  repeating: (facts) => ({
    sentence: 'Stopped: the assistant kept trying the same change, and it couldn’t be made.',
    record: 'Kept trying the same change',
    did: `Refused ${RUN_LIMITS.sameRefusalsBeforeStop} times.`,
    quoted: quoteDetail(facts, 'Why Mosaic refused it'),
    actions: [askAnotherWay, settings('Try another model')],
  }),
  nothing: (facts) => ({
    sentence: `Stopped: the assistant’s last ${RUN_LIMITS.refusedStepsInARow} steps couldn’t be made.`,
    record: `Last ${RUN_LIMITS.refusedStepsInARow} steps couldn’t be made`,
    quoted: quoteDetail(facts, 'The last reason'),
    actions: [askAnotherWay, settings('Try another model')],
  }),
  steps: () => ({
    sentence: `Stopped after ${RUN_LIMITS.steps} steps without finishing.`,
    record: `${RUN_LIMITS.steps} steps without finishing`,
    actions: [{ kind: 'again', label: 'Carry on', isPrimary: true }],
  }),
  fault: (facts) => ({
    sentence: 'Something went wrong in Mosaic, and the run stopped.',
    record: 'Something went wrong in Mosaic',
    quoted: quoteDetail(facts, 'The error'),
    actions: [{ ...again, isPrimary: true }, ...copyError(facts)],
  }),
};

/**
 * Where a server the user runs differs: it has no account or status page, and what fixes it
 * is a setting on the server, which only the user can reach.
 */
const OPENAI_COMPATIBLE_WORDS: Partial<Record<StopKind, (facts: StopFacts) => KindWords>> = {
  cantReach: (facts) => ({
    sentence: `Couldn’t reach the server at ${facts.address}. Check that it’s running.`,
    record: 'Couldn’t reach the server',
    did: facts.tries,
    actions: [{ ...again, isPrimary: true }],
  }),
  keyRefused: () => ({
    sentence:
      'The server wants an API key. Mosaic doesn’t send one to OpenAI-compatible servers yet.',
    record: 'The server wants an API key',
    actions: [settings()],
  }),
  credits: () => ({
    sentence: 'The server says it’s out of credits or over its quota.',
    record: 'The server is out of credits',
    actions: [again],
  }),
  modelMissing: (facts) => ({
    sentence: `The server has no model called ${facts.model}.`,
    record: `No model called ${facts.model}`,
    actions: [settings('Choose a model'), again],
  }),
  noTools: (facts) => ({
    sentence: `${facts.model} on this server can’t use tools, and the assistant needs them.`,
    record: `${facts.model} can’t use tools`,
    did: 'llama.cpp needs --jinja; vLLM needs --enable-auto-tool-choice and a --tool-call-parser.',
    actions: [settings('Choose a model'), again],
  }),
  tooLong: (facts) => ({
    sentence: `This conversation is too long for ${facts.model}.`,
    record: `Too long for ${facts.model}`,
    did: 'Its context size is set on the server: llama.cpp -c, vLLM --max-model-len.',
    actions: [{ kind: 'newConversation', label: 'New conversation' }],
  }),
};

function copyError({ stop }: StopFacts): NoticeAction[] {
  return stop.detail ? [{ kind: 'copy', label: 'Copy the error', text: stop.detail }] : [];
}

/** A Send again that came back the same. */
export const formatSentAgain = (time: string): string => `Sent again at ${time}. Same answer.`;

function describeTries({ attempts }: RunStoppedMessageBody): string | null {
  if (attempts === undefined || attempts < 2) return null;
  return `Tried ${attempts} times.`;
}

const PROVIDER_LABELS = new Map<string, string>(
  MODEL_PROVIDER_OPTIONS.map((option) => [option.id, option.label])
);

function readServerAddress(providerId: string, addresses: ServerAddresses): string | null {
  if (providerId !== 'ollama' && providerId !== 'openaiCompatible') return null;
  return addresses[providerId].replace(/^https?:\/\//, '');
}

function readStopFacts(
  stop: RunStoppedMessageBody,
  runModel: RunModel | null,
  serverAddresses: ServerAddresses,
  newKeySavedAt: number | null
): StopFacts {
  const providerId = runModel?.provider ?? '';
  const providerLabel = PROVIDER_LABELS.get(providerId) ?? (providerId || 'The provider');
  const isOpenAiCompatible = providerId === 'openaiCompatible';
  return {
    newKeySavedAt,
    stop,
    providerLabel,
    provider: isOpenAiCompatible ? 'The server' : providerLabel,
    keyedProvider: KEYED_PROVIDERS.find((keyed) => keyed === providerId) ?? null,
    isOllama: providerId === 'ollama',
    isOpenAiCompatible,
    model: runModel ? shortModelName(runModel.model) : 'the model',
    address: readServerAddress(providerId, serverAddresses),
    tries: describeTries(stop),
  };
}

/** When the run's provider got a key saved after the run stopped, if it did. */
export function findKeySavedSince(
  { model, stoppedAt }: Pick<RunView, 'model' | 'stoppedAt'>,
  saved: SecretsStatus['saved']
): number | null {
  const provider = KEYED_PROVIDERS.find((keyed) => keyed === model?.provider);
  const savedAt = provider && saved[provider]?.savedAt;
  return savedAt && stoppedAt !== null && savedAt > stoppedAt ? savedAt : null;
}

/**
 * The words for a run's stop, for the provider and model that run used; null for the
 * user's own Stop. A server's address is the one Settings has now: runs don't store it.
 */
export function describeStop(
  stop: RunStoppedMessageBody,
  runModel: RunModel | null,
  serverAddresses: ServerAddresses,
  newKeySavedAt: number | null = null
): StopWords | null {
  const kind = readStopKind(stop);
  if (kind === null) return null;
  const facts = readStopFacts(stop, runModel, serverAddresses, newKeySavedAt);
  const describe = (facts.isOpenAiCompatible && OPENAI_COMPATIBLE_WORDS[kind]) || KIND_WORDS[kind];
  const words = describe(facts);
  const level = LEVELS[kind];
  return {
    kind,
    level,
    who: [facts.providerLabel, facts.model, facts.address].filter(Boolean).join(' · '),
    sentence: words.sentence,
    record: words.record,
    quoted: words.quoted === undefined ? quoteProvider(facts) : words.quoted,
    did: words.did ?? null,
    isKeptShown: true,
    actions: words.actions,
  };
}
