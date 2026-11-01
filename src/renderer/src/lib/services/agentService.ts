import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type {
  AgentCarryOnRequest,
  AgentRunEnvelope,
  AgentStartRequest,
  AgentToolCall,
  ConversationPage,
  MessagePage,
} from '@shared/types/agentBridge';

/*
 * The assistant's runs, which happen in main, and the conversation log they write. Stores
 * read the log; `features/agent/` starts, stops and follows the runs.
 */
export const agentService = {
  start: (request: AgentStartRequest) => window.mosaic.agent.start(request),
  carryOn: (request: AgentCarryOnRequest) => window.mosaic.agent.carryOn(request),
  stop: (runId: number) => window.mosaic.agent.stop(runId),
  readMessages: (conversationId: number, page: MessagePage) =>
    window.mosaic.agent.readMessages(conversationId, page),
  readToolResult: (messageId: number, callId: string) =>
    window.mosaic.agent.readToolResult(messageId, callId),
  readOutdatedReads: (conversationId: number, templateId: string | null) =>
    window.mosaic.agent.readOutdatedReads(conversationId, templateId),
  readLastConversationId: () => window.mosaic.agent.readLastConversationId(),
  readConversations: (page: ConversationPage) => window.mosaic.agent.readConversations(page),
  readConversationTitle: (conversationId: number) =>
    window.mosaic.agent.readConversationTitle(conversationId),
  deleteConversation: (conversationId: number) =>
    window.mosaic.agent.deleteConversation(conversationId),
  /** Every run's events; returns the call that stops following them. */
  onEvent: (follow: (envelope: AgentRunEnvelope) => void) => window.mosaic.agent.onEvent(follow),
  /** The page's one tool runner; returns the call that removes it. */
  onToolCall: (run: (call: AgentToolCall) => Promise<AgentToolResult>) =>
    window.mosaic.agent.onToolCall(run),
};
