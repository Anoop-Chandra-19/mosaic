import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { HOUR } from '@shared/time/calendar';
import type { BundleTemplate } from '@shared/types/bundle';
import { formatBundleText } from '@shared/vault/formatBundle';
import { createExampleResume } from '../tools/exampleResume';
import { buildTemplateHistory, type PlannedVersion } from './buildTemplateHistory';
import { editResume } from './editResume';
import { createSeededRandom } from './seededRandom';

/** One version a history is made with, and the change that comes with it. */
export interface HistoryVersion {
  /** Named, as Ctrl+S names it; one kept automatically while editing when left out. */
  name?: string;
  /** The name at the top of the page from this version on. */
  contactName?: string;
  /** Bullets reworded in it; one when it changes nothing else. */
  rewrites?: number;
}

/** A template made with a history, for e2e setup and the palette's presets. */
export interface HistorySpec {
  /** The template's name; "Rowan Vale (history)" when left out. */
  template?: string;
  /** After the version it was created with, v1: these are v2 onwards. */
  versions: HistoryVersion[];
}

const DEFAULT_TEMPLATE_NAME = 'Rowan Vale (history)';

/** The example resume, then each version's change, an hour apart, the newest an hour ago. */
export function planHistory(spec: HistorySpec, now: number): Promise<BundleTemplate> {
  const random = createSeededRandom(spec.versions.length);
  let addedBullets = 0;
  let doc = createExampleResume();
  const startedAt = now - (spec.versions.length + 1) * HOUR;
  const versions: PlannedVersion[] = [{ doc, takenAt: startedAt }];
  for (const [index, version] of spec.versions.entries()) {
    const rewrites = version.rewrites ?? (version.contactName === undefined ? 1 : 0);
    doc = editResume(
      doc,
      { rewrites, contactName: version.contactName },
      random,
      () => `history-added${++addedBullets}`
    );
    versions.push({ doc, name: version.name, takenAt: startedAt + (index + 1) * HOUR });
  }
  const name = spec.template ?? DEFAULT_TEMPLATE_NAME;
  return buildTemplateHistory({ id: 'history', name, versions });
}

/** Adds the template beside what is there, and opens it. */
export async function makeHistory(spec: HistorySpec): Promise<string> {
  const entry = await planHistory(spec, Date.now());
  const templates = useTemplateStore.getState();
  const bundle = { exportedAt: new Date().toISOString(), templates: [entry] };
  const [id] = await templates.importBundle(formatBundleText(bundle), 'as-new-template');
  // With nothing open, the import has opened it already.
  if (useResumeStore.getState().templateId !== id) await templates.openTemplate(id);
  useOverlayStore.getState().closeSurface('start');
  return `Made “${entry.template.name}” with ${entry.versions.length} versions`;
}
