import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import type { ServerAddresses } from './runSource';

/** Read the current server addresses used in notice text. */
export function useServerAddresses(): ServerAddresses {
  const ollama = useAgentSettingsStore((s) => s.ollamaAddress);
  const openaiCompatible = useAgentSettingsStore((s) => s.openAiCompatibleAddress);
  return { ollama, openaiCompatible };
}
