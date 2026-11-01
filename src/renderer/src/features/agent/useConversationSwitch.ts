import { useEffect, useRef, useState } from 'react';
import { resetPaneView } from '@/stores/agentPaneStore';
import {
  openConversation,
  startNewConversation,
  useConversationStore,
} from '@/stores/conversationStore';
import { useTargetStore } from '@/stores/targetStore';

/** Back where the pane was, after an open that failed. */
function returnTo(conversationId: number | null): void {
  if (conversationId === null) return startNewConversation();
  openConversation(conversationId).catch((error: unknown) => {
    console.error('Couldn’t go back to the conversation', error);
    startNewConversation();
  });
}

/**
 * The list of conversations being open, and moving between them from it. Going back without
 * choosing puts the keyboard on the switch that opened it; a new conversation puts it in the
 * prompt box. An open that fails shows the list again, with the line on that row.
 */
export function useConversationSwitch() {
  const [isListOpen, setIsListOpen] = useState(false);
  const [failedOpenId, setFailedOpenId] = useState<number | null>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  const isBack = useRef(false);

  useEffect(() => {
    if (isListOpen || !isBack.current) return;
    isBack.current = false;
    switchRef.current?.focus();
  }, [isListOpen]);

  const openList = () => setIsListOpen(true);

  const goBack = () => {
    isBack.current = true;
    setFailedOpenId(null);
    setIsListOpen(false);
  };

  const startNew = () => {
    setFailedOpenId(null);
    setIsListOpen(false);
    if (useConversationStore.getState().conversationId !== null) {
      resetPaneView();
      startNewConversation();
    }
    useTargetStore.getState().requestTarget('assistantPrompt');
  };

  const open = (conversationId: number) => {
    const before = useConversationStore.getState().conversationId;
    if (conversationId === before) return goBack();
    isBack.current = true;
    setFailedOpenId(null);
    setIsListOpen(false);
    resetPaneView();
    openConversation(conversationId).catch((error: unknown) => {
      console.error('Couldn’t open the conversation', error);
      setFailedOpenId(conversationId);
      setIsListOpen(true);
      returnTo(before);
    });
  };

  /** The conversation is gone: if it was the open one, the pane is on a new one under the list. */
  const leaveDeleted = (conversationId: number) => {
    if (useConversationStore.getState().conversationId !== conversationId) return;
    resetPaneView();
    startNewConversation();
  };

  return { isListOpen, failedOpenId, switchRef, openList, goBack, startNew, open, leaveDeleted };
}
