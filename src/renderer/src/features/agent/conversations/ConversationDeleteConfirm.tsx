import { useEffect, useRef } from 'react';
import { AppButton, Text } from '@/components/ui-kit';
import { titleConversation, type DeleteCase } from './conversationListWords';

const WHAT_GOES: Record<DeleteCase, string> = {
  plain: 'It and its run record are removed from your computer.',
  open: 'It and its run record are removed from your computer. It’s open now, so the pane moves to a new conversation.',
  running:
    'It’s running now. Deleting stops the run first, then removes it and its run record from your computer.',
  openRunning:
    'It’s running now. Deleting stops the run first, then removes it and its run record from your computer. It’s open now, so the pane moves to a new conversation.',
};

interface ConversationDeleteConfirmProps {
  title: string | null;
  deleteCase: DeleteCase;
  isDeleting: boolean;
  onDelete: () => void;
  onKeep: () => void;
}

/**
 * Deleting a conversation asks in its row. Keep it has focus first, and Escape, tabbing away
 * or clicking anywhere else all mean Keep it, until the delete has begun: that can't be taken
 * back, so from then on only its end moves anything.
 */
export function ConversationDeleteConfirm({
  title,
  deleteCase,
  isDeleting,
  onDelete,
  onKeep,
}: ConversationDeleteConfirmProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => keepRef.current?.focus({ preventScroll: true }), []);
  // The buttons are about to be disabled, and a disabled button can't keep the keyboard.
  useEffect(() => {
    if (isDeleting) boxRef.current?.focus({ preventScroll: true });
  }, [isDeleting]);
  const isRunning = deleteCase === 'running' || deleteCase === 'openRunning';
  const question = `Delete “${titleConversation(title, 44)}”?`;

  return (
    <div
      ref={boxRef}
      role="alertdialog"
      aria-label={question}
      aria-busy={isDeleting}
      tabIndex={-1}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== 'Escape') return;
        event.preventDefault();
        if (!isDeleting) onKeep();
      }}
      onBlur={(event) => {
        if (isDeleting || !document.hasFocus()) return;
        if (!boxRef.current?.contains(event.relatedTarget)) onKeep();
      }}
      className="relative rounded-sm bg-del-soft py-2.25 pr-2.5 pl-6.5 ring-1 ring-del-line outline-none ring-inset"
    >
      <span aria-hidden className="absolute top-3.75 left-2.5 size-1.5 rounded-full bg-del" />
      <Text as="p" variant="strong" className="wrap-anywhere">
        {question}
      </Text>
      <Text as="p" variant="secondary" className="mt-0.5 text-pretty text-ink-soft">
        {WHAT_GOES[deleteCase]} There is no undo.
      </Text>
      <span className="mt-2.25 flex flex-wrap justify-end gap-1.5">
        <AppButton ref={keepRef} variant="outline" size="xs" disabled={isDeleting} onClick={onKeep}>
          Keep it
        </AppButton>
        <AppButton variant="danger" size="xs" disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? 'Deleting…' : isRunning ? 'Stop and delete' : 'Delete'}
        </AppButton>
      </span>
    </div>
  );
}
