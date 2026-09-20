import { useActiveTemplate } from './useActiveTemplate';
import { useVersionDistance } from './useVersionDistance';

/**
 * - `none`: no template is open.
 * - `new`: the template has only the version it was created with — no history to be
 *   "up to date" with yet, so the design shows no badge.
 * - `clean` / `edited`: whether the draft still matches the newest version. Undoing every
 *   change since that version counts as matching it again.
 */
export type TemplateStatus = 'none' | 'new' | 'clean' | 'edited';

export function useTemplateStatus(): TemplateStatus {
  const template = useActiveTemplate();
  const distance = useVersionDistance();
  if (!template) return 'none';
  if (template.versionCount === 1 && template.head.kind === 'auto') return 'new';
  return distance.matches ? 'clean' : 'edited';
}
