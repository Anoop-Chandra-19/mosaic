import type { KeyedProvider, SecretsStatus } from '@shared/types/secrets';
import { SettingRow } from '../../SettingRow';
import { KeyMessageLine } from './ApiKeyMessage';
import { isModelListed } from './groupModelChoices';
import { readKeyState } from './apiKeyWords';
import { MODEL_PROVIDER_OPTION_BY_ID } from './modelProviderOptions';
import { ModelCombobox } from './ModelCombobox';
import { useModelList } from './useModelList';

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
        keyState={keyState}
        modelList={modelList}
        onChange={onChange}
      />
    </SettingRow>
  );
}
