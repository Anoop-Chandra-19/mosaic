import { AGENT_TOOLS } from '@shared/agent-tools/agentTools';
import type { ModelSetup } from '@shared/types/modelTool';
import { buildSystemPrompt } from './buildSystemPrompt';

/**
 * The system prompt and tools a run sends with every request. A run and the developer
 * tools' read of it both build it here, so the read can't differ from what was sent.
 */
export function buildModelSetup(openResumeName: string | null): ModelSetup {
  return { system: buildSystemPrompt(openResumeName), tools: Object.values(AGENT_TOOLS) };
}
