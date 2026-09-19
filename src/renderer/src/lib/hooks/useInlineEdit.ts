import { useState, useCallback, type KeyboardEvent } from 'react';

/**
 * `openAtStart`: start in editing, for a field whose value was only a placeholder.
 * `onClose`: called when editing ends, whether it saved or was cancelled.
 */
export function useInlineEdit(
  value: string,
  onSave: (next: string) => void,
  openAtStart = false,
  onClose?: () => void
) {
  const [editing, setEditing] = useState(openAtStart);
  const [draft, setDraft] = useState(value);

  const startEditing = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    onClose?.();
  }, [draft, value, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      } else if (e.key === 'Escape') {
        setDraft(value);
        setEditing(false);
        onClose?.();
      }
    },
    [value, onClose]
  );

  return { editing, draft, setDraft, startEditing, handleBlur, handleKeyDown };
}
