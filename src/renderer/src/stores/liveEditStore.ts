import { create } from 'zustand';
import type { ContactInfo, ResumeSection } from '@shared/types/resume';

export interface ShownResume {
  contact: ContactInfo;
  sections: ResumeSection[];
}

/** The resume with an editor's unsaved text in it. */
export type LiveEdit = (resume: ShownResume) => ShownResume;

/**
 * Text being typed and not yet saved, for the preview to show as it is typed. Never
 * persisted, and nothing else reads it: undo, autosave, and history see only saved text.
 */
interface LiveEditState {
  owner: string | null;
  edit: LiveEdit | null;
  show: (owner: string, edit: LiveEdit) => void;
  clear: (owner: string) => void;
}

export const useLiveEditStore = create<LiveEditState>()((set, get) => ({
  owner: null,
  edit: null,
  show: (owner, edit) => set({ owner, edit }),
  // Only its own: an editor closing must not clear the one that opened after it.
  clear: (owner) => {
    if (get().owner === owner) set({ owner: null, edit: null });
  },
}));
