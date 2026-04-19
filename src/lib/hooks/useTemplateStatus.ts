import { useMemo } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { resumeEqual } from '@/lib/template/compareResume';

export type TemplateStatus = 'clean' | 'modified' | 'untracked';

export function useTemplateStatus(): TemplateStatus {
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId);
  const activeVersionId = useTemplateStore((s) => s.activeVersionId);
  const versionsByTemplateId = useTemplateStore((s) => s.versionsByTemplateId);

  return useMemo(() => {
    if (!activeTemplateId || !activeVersionId) return 'untracked';

    const versions = versionsByTemplateId[activeTemplateId];
    const activeVersion = versions?.find((v) => v.id === activeVersionId);
    if (!activeVersion) return 'untracked';

    const current = { schemaVersion, contact, sections };
    return resumeEqual(current, activeVersion.snapshot) ? 'clean' : 'modified';
  }, [schemaVersion, contact, sections, activeTemplateId, activeVersionId, versionsByTemplateId]);
}
