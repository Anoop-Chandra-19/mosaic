import { useEffect, useRef, useState } from 'react';
import { resetPaneView } from '@/stores/agentPaneStore';
import {
  openConversation,
  startNewConversation,
  useConversationStore,
} from '@/stores/conversationStore';
import { useTargetStore } from '@/stores/targetStore';

/** Restore the previous conversation after opening another conversation fails. */
function returnTo(conversationId: number | null): void {
  if (conversationId === null) return startNewConversation();
  openConversation(conversationId).catch((error: unknown) => {
    console.error('Couldn’t go back to the conversation', error);
    startNewConversation();
  });
}

/**
 * Manage the conversation list and switching conversations from it. Going back without
 * choosing restores focus to the button that opened the list. A new conversation focuses
 * the prompt box. If opening fails, show the list again with an error on that row.
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

  /** After deletion, replace the open conversation with a new one beneath the list. */
  const leaveDeleted = (conversationId: number) => {
    if (useConversationStore.getState().conversationId !== conversationId) return;
    resetPaneView();
    startNewConversation();
  };

  return { isListOpen, failedOpenId, switchRef, openList, goBack, startNew, open, leaveDeleted };
}
