import type { MosaicAgent } from '../types/agentBridge';

/** Renderer → main: `MosaicAgent`'s requests, one channel per method. */
export const AGENT_CHANNELS = {
  start: 'agent:start',
  carryOn: 'agent:carry-on',
  stop: 'agent:stop',
  readMessages: 'agent:read-messages',
  readToolResult: 'agent:read-tool-result',
  readOutdatedReads: 'agent:read-outdated-reads',
  readLastConversationId: 'agent:read-last-conversation-id',
  readConversations: 'agent:read-conversations',
  deleteConversation: 'agent:delete-conversation',
} as const satisfies Record<Exclude<keyof MosaicAgent, 'onEvent' | 'onToolCall'>, string>;

/** Main → renderer: an `AgentRunEnvelope`. */
export const AGENT_EVENT = 'agent:event';
/** Main → renderer: an `AgentToolCall` for the page to run. */
export const AGENT_TOOL_CALL = 'agent:tool-call';
/** Renderer → main: the run id, the call id, and the page's `AgentToolAnswer`. */
export const AGENT_TOOL_ANSWER = 'agent:tool-answer';
