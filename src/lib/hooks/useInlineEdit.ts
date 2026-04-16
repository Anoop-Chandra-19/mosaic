import { useState, useCallback, type KeyboardEvent } from 'react';

export function useInlineEdit(value: string, onSave: (next: string) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      } else if (e.key === 'Escape') {
        setDraft(value);
        setEditing(false);
      }
    },
    [value]
  );

  return { editing, draft, setDraft, startEditing, handleBlur, handleKeyDown };
}
