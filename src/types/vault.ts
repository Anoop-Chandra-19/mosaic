import type { ResumeData, TemplateRecord, TemplateVersion } from '@/types/resume';

/**
 * The slice of template state that survives reloads (templateStore's
 * partialize output) and the only template data that enters vault backups.
 */
export interface PersistedTemplateState {
  templates: TemplateRecord[];
  versionsByTemplateId: Record<string, TemplateVersion[]>;
  activeTemplateId: string | null;
  activeVersionId: string | null;
}

export const VAULT_VERSION = 1 as const;

/**
 * The user-owned backup file format. Document data only — UI preferences,
 * AI configuration, and secrets must never appear in a vault.
 */
export interface MosaicVault {
  vaultVersion: typeof VAULT_VERSION;
  exportedAt: string;
  resume: ResumeData;
  templates: PersistedTemplateState;
}
