import { useRef } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import { NEW_CUSTOM_SECTION_LABEL } from './section-icons';

/**
 * "Custom section" in a dropdown menu. The section is added once the menu has closed:
 * while it is open, the menu holds focus, and the new section's name field — which opens
 * for editing — would lose it straight away.
 */
export function useAddCustomSection(onAdded: (sectionId: string) => void) {
  const addSection = useResumeStore((s) => s.addSection);
  const pending = useRef(false);

  return {
    /** The menu item's `onSelect`. */
    choose: () => {
      pending.current = true;
    },
    /** The menu content's `onCloseAutoFocus`. */
    onCloseAutoFocus: (event: Event) => {
      if (!pending.current) return;
      pending.current = false;
      event.preventDefault();
      onAdded(addSection('custom', NEW_CUSTOM_SECTION_LABEL));
    },
  };
}
