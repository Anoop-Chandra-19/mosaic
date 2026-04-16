import type { FocusEvent } from 'react';

export function useSaveOnBlur(currentValue: string, onSave: (value: string) => void) {
  return {
    onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value.trim();
      if (next && next !== currentValue) onSave(next);
    },
  };
}
