import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { MosaicVault } from '@/types/vault';

export async function readFileText(file: File): Promise<string | null> {
  try {
    return await file.text();
  } catch {
    return null;
  }
}

/**
 * Replace the user's document data with a parsed vault. Ephemeral template
 * state is cleared — pending AI diffs and rollback checkpoints reference
 * entry ids that no longer exist after an import.
 */
export function applyVault(vault: MosaicVault): void {
  useResumeStore.getState().replaceResume(vault.resume);
  useTemplateStore.setState({
    ...vault.templates,
    pendingAiChanges: [],
    rollbackSnapshots: {},
  });
}

export function describeVault(vault: MosaicVault): {
  exportedAt: string;
  templateCount: number;
  sectionCount: number;
  contactName: string;
} {
  return {
    exportedAt: vault.exportedAt,
    templateCount: vault.templates.templates.length,
    sectionCount: vault.resume.sections.length,
    contactName: vault.resume.contact.name,
  };
}
