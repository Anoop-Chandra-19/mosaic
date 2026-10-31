import { ChevronDown } from 'lucide-react';
import {
  AppButton,
  AppMenu,
  AppMenuContent,
  AppMenuRadioGroup,
  AppMenuRadioItem,
  AppMenuTrigger,
  Text,
} from '@/components/ui-kit';
import { MODEL_PROVIDER_OPTION_BY_ID, MODEL_PROVIDER_OPTIONS } from '@/lib/modelProviderOptions';
import type { ModelProviderId } from '@shared/types/modelProviders';
import type { SecretsStatus } from '@shared/types/secrets';
import { readKeyState } from './apiKeyWords';
import { KeyStatus } from './KeyStatus';

/** The provider choice, with each provider's key status so all of them show without switching. */
export function ProviderMenu({
  provider,
  status,
  onChange,
}: {
  provider: ModelProviderId;
  status: SecretsStatus | null;
  onChange: (provider: ModelProviderId) => void;
}) {
  const chosen = MODEL_PROVIDER_OPTION_BY_ID[provider];
  return (
    <AppMenu>
      <AppMenuTrigger asChild>
        <AppButton variant="field" size="sm" className="w-[13.375rem]" aria-label="Provider">
          {chosen.label}
          {chosen.trust === 'Local' && ' (local)'}
          <ChevronDown className="size-3.25" />
        </AppButton>
      </AppMenuTrigger>
      <AppMenuContent align="end" className="w-75">
        <AppMenuRadioGroup
          value={provider}
          onValueChange={(value) => onChange(value as ModelProviderId)}
        >
          {MODEL_PROVIDER_OPTIONS.map((option) => {
            const state = readKeyState(option.id, status);
            return (
              <AppMenuRadioItem key={option.id} value={option.id}>
                <span className="font-control text-foreground">{option.label}</span>
                {option.trust !== 'Direct API' && (
                  <Text
                    variant="tag"
                    className="rounded-[0.25rem] border border-line-strong px-1 text-ink-faint"
                  >
                    {option.trust}
                  </Text>
                )}
                {state && <KeyStatus state={state} className="ml-auto" />}
              </AppMenuRadioItem>
            );
          })}
        </AppMenuRadioGroup>
      </AppMenuContent>
    </AppMenu>
  );
}
