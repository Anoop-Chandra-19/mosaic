import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { TemplateSummary } from '@shared/types/db';

/** The template whose draft is in the editor, or undefined when none is open. */
export function useActiveTemplate(): TemplateSummary | undefined {
  const templateId = useResumeStore((s) => s.templateId);
  return useTemplateStore((s) => s.templates.find((t) => t.id === templateId));
}
