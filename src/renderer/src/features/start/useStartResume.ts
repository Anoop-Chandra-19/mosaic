import { useRef } from 'react';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import type { ResumeData } from '@shared/types/resume';

/**
 * Create a template, open it in the editor, and say so. Every "start a resume" button goes
 * through here; a second click while the first is still being written is ignored.
 */
export function useStartResume() {
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const setStartOpen = useOverlayStore((s) => s.setStartOpen);
  const setActiveSidebarTab = useUiStore((s) => s.setActiveSidebarTab);
  const busy = useRef(false);

  return async (name: string, doc: ResumeData, toast: string) => {
    if (busy.current) return;
    busy.current = true;
    const created = await attempt(createTemplate(name, doc), 'Could not create the resume');
    busy.current = false;
    if (!created) return;
    setStartOpen(false);
    setActiveSidebarTab('content');
    showToast(toast);
  };
}
