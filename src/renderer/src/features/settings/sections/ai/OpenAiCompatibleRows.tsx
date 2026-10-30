import { modelsService } from '@/lib/services/modelsService';
import {
  DEFAULT_OPENAI_COMPATIBLE_ADDRESS,
  isLocalServerAddress,
  normalizeOpenAiCompatibleAddress,
  serverHost,
} from '@shared/model-providers/serverAddress';
import type { OpenAiCompatibleModels } from '@shared/types/modelProviders';
import { SettingRow } from '../../SettingRow';
import { ModelCombobox, ModelListResult } from './ModelCombobox';
import { ServerAddressRow, ServerNote } from './ServerAddressRow';
import { useAskedAnswer } from './useAskedAnswer';

/** Where the server is, and where resume text will go from there. */
export function OpenAiCompatibleAddressRow({
  address,
  onChange,
}: {
  address: string;
  onChange: (address: string) => void;
}) {
  const place = isLocalServerAddress(address)
    ? 'A server on your computer, so your resume text never leaves it.'
    : `A server at ${serverHost(address)}, so your resume text goes there when you ask for something.`;
  return (
    <ServerAddressRow
      label="Server address"
      address={address}
      defaultAddress={DEFAULT_OPENAI_COMPATIBLE_ADDRESS}
      normalize={normalizeOpenAiCompatibleAddress}
      example="192.168.1.50:8080"
      description={`${place} llama.cpp listens on port 8080, LM Studio on 1234, vLLM on 8000.`}
      onChange={onChange}
    />
  );
}

/** What's wrong with the list or the chosen model, in a sentence; null when nothing is. */
function describeListProblem(
  answer: OpenAiCompatibleModels | null,
  model: string,
  host: string
): string | null {
  if (!answer) return null;
  if (!answer.ok) {
    return answer.reason === 'unreachable'
      ? `Nothing answered at ${host}. Check that the server is running, then try again.`
      : `Something at ${host} answered, but with no list of models. Check the address, or type a name.`;
  }
  if (answer.models.length === 0) return 'The server lists no models. Load one, or type a name.';
  return answer.models.includes(model)
    ? null
    : `The server doesn’t list “${model}”. Pick one of its models, or check the name.`;
}

function describeListed(answer: Extract<OpenAiCompatibleModels, { ok: true }>): string {
  const count = answer.models.length;
  return `${count} ${count === 1 ? 'model' : 'models'} listed by the server`;
}

/** The server's model: one it lists, or any name typed in, since not every server lists all. */
export function OpenAiCompatibleModelRow({
  active,
  address,
  model,
  onChange,
}: {
  /** AI is on, so the server may be asked for its models. */
  active: boolean;
  address: string;
  model: string;
  onChange: (model: string) => void;
}) {
  const { value, isWaiting, refresh } = useAskedAnswer(active, address, () =>
    modelsService.openAiCompatibleModels(address)
  );
  const problem = active ? describeListProblem(value, model, serverHost(address)) : null;

  return (
    <SettingRow
      label="Model"
      description={
        <>
          Models the server lists. Type to search, or to use a name it doesn’t list.
          {problem && <ServerNote tone="warning">{problem}</ServerNote>}
        </>
      }
    >
      <ModelCombobox
        provider="openaiCompatible"
        model={model}
        suggested={null}
        listed={value?.ok ? value.models : []}
        footer={
          !value || isWaiting ? (
            'Asking the server for its models…'
          ) : (
            <ModelListResult
              words={value.ok ? describeListed(value) : 'No list from the server.'}
              actionLabel={value.ok ? 'Refresh' : 'Try again'}
              onAction={refresh}
            />
          )
        }
        onChange={onChange}
      />
    </SettingRow>
  );
}
