import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import type { ServerAddresses } from './runSource';

/** The addresses a notice's words name. */
export function useServerAddresses(): ServerAddresses {
  const ollama = useAgentSettingsStore((s) => s.ollamaAddress);
  const openaiCompatible = useAgentSettingsStore((s) => s.openAiCompatibleAddress);
  return { ollama, openaiCompatible };
}
