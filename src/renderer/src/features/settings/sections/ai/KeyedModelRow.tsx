import type { ReactNode } from 'react';
import { formatRelativeTime } from '@shared/time/formatTime';
import type { KeyedProvider, ModelListing, SecretsStatus } from '@shared/types/secrets';
import { SettingRow } from '../../SettingRow';
import { KeyMessageLine } from './ApiKeyMessage';
import { isModelListed } from './groupModelChoices';
import { readKeyState, type KeyState } from './apiKeyWords';
import { MODEL_PROVIDER_OPTION_BY_ID } from '@/lib/modelProviderOptions';
import { ModelCombobox, ModelListResult } from './ModelCombobox';
import { useModelList, type ModelListAnswer } from './useModelList';

/** What a provider's list leaves out, said after how many it hid. */
const HIDDEN_KINDS: Record<KeyedProvider, string> = {
  anthropic: 'embeddings, speech, images',
  openai: 'embeddings, speech, images',
  google: 'embeddings, speech, images',
  openrouter: 'no tool use',
};

const LIST_FAILURES: Record<
  Extract<ModelListing, { ok: false }>['reason'],
  (label: string, httpStatus?: number) => string
> = {
  refused: (label) => `${label} turned the key down, so there is no list.`,
  unreachable: (label) => `Couldn’t reach ${label} for the list.`,
  failed: (label, httpStatus) =>
    `${label} answered with an error${httpStatus ? ` (${httpStatus})` : ''}, so there is no list.`,
  keychain: () => 'The keychain didn’t hand over the key, so there is no list.',
  'no-key': () => 'Save a key to see every model it can reach.',
};

function describeListing(provider: KeyedProvider, listing: ModelListing): string {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  if (!listing.ok) return LIST_FAILURES[listing.reason](label, listing.httpStatus);
  const { models, hiddenCount, listedAt } = listing.list;
  const count = `${models.length} chat ${models.length === 1 ? 'model' : 'models'}`;
  const others = hiddenCount === 1 ? '1 other' : `${hiddenCount} others`;
  const hidden = hiddenCount > 0 ? `, ${others} hidden (${HIDDEN_KINDS[provider]})` : '';
  return `${count} listed by ${label} ${formatRelativeTime(listedAt)}${hidden}`;
}

/** The footer's words, before any list or while one is on its way. */
function describeMissingList(
  provider: KeyedProvider,
  keyState: KeyState | null,
  isLoading: boolean
) {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  if (isLoading) return `Asking ${label} for its models…`;
  return keyState === 'unchecked' || keyState === 'refused'
    ? 'Check the key to see every model it can reach.'
    : 'Save a key to see every model it can reach.';
}

function buildListFooter(
  provider: KeyedProvider,
  keyState: KeyState | null,
  { listing, isLoading, refresh }: ModelListAnswer
): ReactNode {
  if (!listing || isLoading) return describeMissingList(provider, keyState, isLoading);
  return (
    <ModelListResult
      words={describeListing(provider, listing)}
      actionLabel={listing.ok ? 'Refresh' : 'Try again'}
      onAction={refresh}
    />
  );
}

interface KeyedModelRowProps {
  /** AI is on, so the provider may be asked for the key's models. */
  active: boolean;
  provider: KeyedProvider;
  status: SecretsStatus | null;
  model: string;
  suggested: string;
  onChange: (model: string) => void;
}

/**
 * The model for a provider used with a key, picked from what the key's list offers. A name
 * the list doesn't have can still be used, and the row says the key can't reach it.
 */
export function KeyedModelRow({
  active,
  provider,
  status,
  model,
  suggested,
  onChange,
}: KeyedModelRowProps) {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  const keyState = readKeyState(provider, status);
  const modelList = useModelList(active, provider, status?.saved[provider]);
  const { listing } = modelList;
  const isModelUnlisted = listing?.ok === true && !isModelListed(listing.list.models, model);
  const hasCheckedKey = keyState === 'saved' || keyState === 'savedForSession';

  return (
    <SettingRow
      label="Model"
      description={
        <>
          {hasCheckedKey
            ? `Models ${label} lists for your key. Type to search.`
            : 'Pick from the list once a key is saved, or type a name.'}
          {isModelUnlisted && (
            <span className="mt-1.5 block">
              <KeyMessageLine tone="warn">
                Your key works, but {label} doesn’t offer “{model}” to it. Check the name, or pick{' '}
                {suggested}.
              </KeyMessageLine>
            </span>
          )}
        </>
      }
    >
      <ModelCombobox
        provider={provider}
        model={model}
        suggested={suggested}
        listed={listing?.ok ? listing.list.models : []}
        footer={buildListFooter(provider, keyState, modelList)}
        onChange={onChange}
      />
    </SettingRow>
  );
}
