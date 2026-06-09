import { migrateResume } from '@/lib/resume/migrateResume';
import type { PersistedTemplateState } from '@/types/vault';
import type { TemplateRecord, TemplateVersion } from '@/types/resume';

/**
 * Normalize persisted template state to the current shape. Idempotent — runs
 * on every rehydrate regardless of envelope version (same approach as
 * aiStore's normalizePersistedAIState), so corrupt or partial data never
 * crashes hydration. Also reused when importing vault backups.
 */
export function migrateTemplateState(persisted: unknown): PersistedTemplateState {
  const raw =
    typeof persisted === 'object' && persisted !== null
      ? (persisted as Partial<PersistedTemplateState>)
      : {};

  const templates: TemplateRecord[] = Array.isArray(raw.templates) ? raw.templates : [];

  const versionsByTemplateId: Record<string, TemplateVersion[]> = {};
  if (typeof raw.versionsByTemplateId === 'object' && raw.versionsByTemplateId !== null) {
    for (const [templateId, versions] of Object.entries(raw.versionsByTemplateId)) {
      if (!Array.isArray(versions)) continue;
      versionsByTemplateId[templateId] = versions.map((version) => ({
        ...version,
        snapshot: migrateResume(version.snapshot),
      }));
    }
  }

  let activeTemplateId = typeof raw.activeTemplateId === 'string' ? raw.activeTemplateId : null;
  let activeVersionId = typeof raw.activeVersionId === 'string' ? raw.activeVersionId : null;

  const activeTemplate = templates.find((t) => t.id === activeTemplateId);
  if (!activeTemplate) {
    activeTemplateId = null;
    activeVersionId = null;
  } else if (activeVersionId) {
    const versions = versionsByTemplateId[activeTemplate.id] ?? [];
    if (!versions.some((v) => v.id === activeVersionId)) {
      activeVersionId = activeTemplate.headVersionId;
    }
  }

  return { templates, versionsByTemplateId, activeTemplateId, activeVersionId };
}
