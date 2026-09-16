import { useRef } from 'react';
import { NEW_CUSTOM_SECTION_LABEL } from '@/lib/resume/sectionPresets';
import { useResumeStore } from '@/stores/resumeStore';
import type { SectionLayout } from '@/types/resume';

/**
 * "Custom section" and "Custom list" in a dropdown menu. The section is added once the menu
 * has closed: while it is open, the menu holds focus, and the new section's name field —
 * which opens for editing — would lose it straight away.
 */
export function useAddCustomSection(onAdded: (sectionId: string) => void) {
  const addSection = useResumeStore((s) => s.addSection);
  const pending = useRef<SectionLayout | null>(null);

  return {
    /** The menu item's `onSelect`. */
    choose: (layout: SectionLayout) => {
      pending.current = layout;
    },
    /** The menu content's `onCloseAutoFocus`. */
    onCloseAutoFocus: (event: Event) => {
      const layout = pending.current;
      if (!layout) return;
      pending.current = null;
      event.preventDefault();
      onAdded(addSection({ kind: 'custom', layout, label: NEW_CUSTOM_SECTION_LABEL[layout] }));
    },
  };
}
