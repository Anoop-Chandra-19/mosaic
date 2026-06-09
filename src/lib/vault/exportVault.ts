import { buildVaultFileName } from '@/lib/export/filename';
import { downloadTextFile } from '@/lib/export/downloadFile';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { VAULT_VERSION, type MosaicVault, type PersistedTemplateState } from '@/types/vault';
import type { ResumeData } from '@/types/resume';

export function buildVault(
  resume: ResumeData,
  templates: PersistedTemplateState,
  now: Date = new Date()
): MosaicVault {
  return {
    vaultVersion: VAULT_VERSION,
    exportedAt: now.toISOString(),
    resume,
    templates,
  };
}

export function serializeVault(vault: MosaicVault): string {
  return JSON.stringify(vault, null, 2);
}

/**
 * Snapshot the user's document data (resume + templates — never UI/AI state
 * or secrets) and download it as a vault backup file.
 */
export function exportVaultToFile(): void {
  const { templates, versionsByTemplateId, activeTemplateId, activeVersionId } =
    useTemplateStore.getState();

  const vault = buildVault(
    getResumeSnapshot(),
    structuredClone({ templates, versionsByTemplateId, activeTemplateId, activeVersionId })
  );

  downloadTextFile({
    fileName: buildVaultFileName(),
    content: serializeVault(vault),
  });
}
