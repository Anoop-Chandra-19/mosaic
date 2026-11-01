import { MODEL_PROVIDER_OPTIONS } from '@/lib/modelProviderOptions';
import { shortModelName } from '@/lib/shortModelName';
import type { RunModel } from '@shared/types/agentConversation';
import type { ModelProviderError } from '@shared/types/modelReply';
import type { QuotedWords } from './noticeWords';

/*
 * Who a run's trouble came from, as notices name them: the provider and model in the source
 * line, the provider in sentences, and the provider's own words quoted.
 */

/** Where the servers the user runs listen, as Settings has them now. */
export interface ServerAddresses {
  ollama: string;
  openaiCompatible: string;
}

export interface RunSource {
  /** The name a notice opens with: "OpenAI-compatible". */
  providerLabel: string;
  /** Who the sentences talk about: "OpenAI", or "The server". */
  provider: string;
  model: string;
  /** Where a server the user runs listens, as the address line reads it; else null. */
  address: string | null;
}

const PROVIDER_LABELS = new Map<string, string>(
  MODEL_PROVIDER_OPTIONS.map((option) => [option.id, option.label])
);

function readServerAddress(providerId: string, addresses: ServerAddresses): string | null {
  if (providerId !== 'ollama' && providerId !== 'openaiCompatible') return null;
  return addresses[providerId].replace(/^https?:\/\//, '');
}

export function readRunSource(
  runModel: RunModel | null,
  serverAddresses: ServerAddresses
): RunSource {
  const providerId = runModel?.provider ?? '';
  const providerLabel = PROVIDER_LABELS.get(providerId) ?? (providerId || 'The provider');
  return {
    providerLabel,
    provider: providerId === 'openaiCompatible' ? 'The server' : providerLabel,
    model: runModel ? shortModelName(runModel.model) : 'the model',
    address: readServerAddress(providerId, serverAddresses),
  };
}

export const formatWho = ({ providerLabel, model, address }: RunSource) =>
  [providerLabel, model, address].filter(Boolean).join(' · ');

/** What the provider said; for a connection that never got there, what your computer said. */
export function quoteProviderError(
  error: ModelProviderError,
  provider: string
): QuotedWords | null {
  if (!error.message) return null;
  return {
    label: error.reason === 'unreachable' ? 'Your computer said' : `${provider} said`,
    code: error.httpStatus === undefined ? null : String(error.httpStatus),
    text: error.message,
  };
}
