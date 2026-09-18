import { useResumeStore } from '@/stores/resumeStore';
import { useActiveTemplate } from './useActiveTemplate';

/**
 * - `none`: no template is open.
 * - `new`: the template has only the version it was created with — no history to be
 *   "up to date" with yet, so the design shows no badge.
 * - `clean` / `edited`: whether the draft still matches the newest version. Every edit
 *   bumps the draft's rev, and each version records the rev it was taken at.
 */
export type TemplateStatus = 'none' | 'new' | 'clean' | 'edited';

export function useTemplateStatus(): TemplateStatus {
  const template = useActiveTemplate();
  const rev = useResumeStore((s) => s.rev);
  if (!template) return 'none';
  if (template.versionCount === 1 && template.head.kind === 'auto') return 'new';
  return rev === template.head.rev ? 'clean' : 'edited';
}
