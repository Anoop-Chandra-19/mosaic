import { MODEL_PROVIDER_OPTION_BY_ID } from '@/lib/modelProviderOptions';
import { DEFAULT_MODEL_BY_PROVIDER, useAgentSettingsStore } from '@/stores/agentSettingsStore';

/** The provider and model Settings names, which the next run uses. */
export function useChosenModel(): { providerLabel: string; model: string } {
  const provider = useAgentSettingsStore((s) => s.provider);
  const model = useAgentSettingsStore((s) => s.modelsByProvider[s.provider]);
  return {
    providerLabel: MODEL_PROVIDER_OPTION_BY_ID[provider].label,
    model: model || DEFAULT_MODEL_BY_PROVIDER[provider],
  };
}
