import { describeDraftChanges } from '@shared/resume/describeDraftChanges';
import type { BundleTemplate, BundleVersion } from '@shared/types/bundle';
import type { ResumeData } from '@shared/types/resume';

/** One version to write, holding its whole document. */
export interface PlannedVersion {
  doc: ResumeData;
  /** Named, as Ctrl+S names it; otherwise one kept automatically while editing. */
  name?: string;
  /** Added to the edit before it, as a later revision of one editing session (v12.1). */
  isRevision?: boolean;
  /** When it was taken, in epoch milliseconds. */
  takenAt: number;
}

/** A template and its versions, oldest first: the first is the one it was created with. */
export interface PlannedTemplate {
  id: string;
  name: string;
  versions: PlannedVersion[];
}

const iso = (ms: number) => new Date(ms).toISOString();

/** What the app writes for each kind of version. */
function describeVersion(
  planned: PlannedVersion,
  isFirst: boolean,
  numberBase: ResumeData | null
): Pick<BundleVersion, 'kind' | 'source' | 'summary' | 'section'> {
  if (isFirst) return { kind: 'auto', source: 'create', summary: 'Created', section: null };
  if (planned.name) {
    return { kind: 'named', source: 'name', summary: planned.name, section: null };
  }
  const changes = numberBase
    ? describeDraftChanges(numberBase, planned.doc)
    : { summary: 'Edited the resume', section: null };
  return { kind: 'auto', source: 'edit', ...changes };
}

/**
 * The template as a backup holds it, with the history the app would have written: numbers
 * rising, an editing session's revisions on one number, each edit summarized against what
 * its number started from. The draft is the newest version. `afterEach` runs after every
 * version, so a long history can report how far it has got and let the window draw.
 */
export async function buildTemplateHistory(
  plan: PlannedTemplate,
  afterEach?: () => Promise<void>
): Promise<BundleTemplate> {
  const versions: BundleVersion[] = [];
  let numberBase: ResumeData | null = null;
  for (const [index, planned] of plan.versions.entries()) {
    const previous = versions.at(-1);
    const isRevision =
      previous !== undefined && planned.isRevision && !planned.name && previous.source === 'edit';
    if (!isRevision) numberBase = previous?.doc ?? null;
    versions.push({
      id: `${plan.id}-v${index + 1}`,
      number: isRevision ? previous.number : (previous?.number ?? 0) + 1,
      revision: isRevision ? previous.revision + 1 : 0,
      parentId: previous?.id ?? null,
      ...describeVersion(planned, index === 0, numberBase),
      rev: index + 1,
      createdAt: iso(planned.takenAt),
      doc: planned.doc,
    });
    await afterEach?.();
  }
  const first = plan.versions[0];
  const last = plan.versions[plan.versions.length - 1];
  return {
    template: {
      id: plan.id,
      name: plan.name,
      rev: plan.versions.length,
      createdAt: iso(first.takenAt),
      updatedAt: iso(last.takenAt),
    },
    draft: last.doc,
    versions,
  };
}
