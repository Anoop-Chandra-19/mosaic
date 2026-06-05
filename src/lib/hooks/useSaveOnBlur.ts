import type { FocusEvent } from 'react';

export function useSaveOnBlur(currentValue: string, onSave: (value: string) => void) {
  // Keep form fields uncontrolled while typing; commit trimmed changes on blur.
  return {
    onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value.trim();
      if (next && next !== currentValue) onSave(next);
    },
  };
}
