import { goToView } from '@/features/view-address/viewAddress';
import { formatSeconds } from '@shared/time/formatTime';
import { appService } from '@/lib/services/appService';
import { showProgressToast } from '@/stores/toastStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { BundleTemplate, ImportMode } from '@shared/types/bundle';
import { formatBundleText } from '@shared/vault/formatBundle';
import { showUnderWay } from '../devToolsStore';
import {
  countProfileVersions,
  generateProfileTemplates,
  type GeneratedProfileName,
  type ProfileName,
} from './profiles';

/**
 * Versions written in one restore at most. Everyday and Heavy fit in one, so a failure leaves
 * the data as it was; Worst case is written in parts, or the page and main would each hold
 * thousands of copies of its resume at once.
 */
const MAX_VERSIONS_PER_WRITE = 1000;

let isLoading = false;

/** As Settings' Erase does: everything goes, and the app starts again as on first run. */
async function eraseEverything(): Promise<string> {
  await appService.eraseAll();
  window.location.reload();
  return '';
}

function showLoading(name: ProfileName, detail: string, percent: number | null): void {
  showProgressToast(`Loading ${name}`, { detail, percent });
  showUnderWay(percent === null ? `Loading ${name}` : `Loading ${name} ${percent}%`);
}

const countVersions = (templates: readonly BundleTemplate[]) =>
  templates.reduce((sum, entry) => sum + entry.versions.length, 0);

/** Templates in parts of at most `MAX_VERSIONS_PER_WRITE` versions; one larger is a part alone. */
async function* groupIntoParts(
  templates: AsyncIterable<BundleTemplate>
): AsyncGenerator<BundleTemplate[]> {
  let part: BundleTemplate[] = [];
  for await (const template of templates) {
    if (part.length && countVersions(part) + template.versions.length > MAX_VERSIONS_PER_WRITE) {
      yield part;
      part = [];
    }
    part.push(template);
  }
  if (part.length) yield part;
}

/**
 * Generated in the page a template at a time, then written as a backup restored over
 * everything: the first part replaces all templates, each after it adds its own beside them.
 * Opens the first template on its own.
 */
async function writeProfile(name: GeneratedProfileName): Promise<string> {
  const startedAt = performance.now();
  const total = countProfileVersions(name);
  const templates = generateProfileTemplates(name, Date.now(), (made) =>
    showLoading(name, 'generating templates', Math.round((made / total) * 100))
  );
  // Nothing open over a template the restore takes away.
  await goToView({ kind: 'start' });
  let mode: ImportMode = 'restore-all';
  // Only what the toast says of the first, so its versions are let go once written.
  let first: { template: BundleTemplate['template']; versionCount: number } | null = null;
  let templateCount = 0;
  for await (const part of groupIntoParts(templates)) {
    first ??= { template: part[0].template, versionCount: part[0].versions.length };
    templateCount += part.length;
    showLoading(name, 'writing', null);
    const bundle = { exportedAt: new Date().toISOString(), templates: part };
    await useTemplateStore.getState().importBundle(formatBundleText(bundle), mode);
    mode = 'as-new-template';
  }
  if (!first) throw new Error(`${name} holds no templates`);
  await goToView({ kind: 'editor', template: first.template.name }, first.template.id);
  const took = formatSeconds(performance.now() - startedAt);
  return `Loaded ${name} in ${took}. ${templateCount} templates, ${first.versionCount} versions on ${first.template.name}.`;
}

/** Replaces all development data with the profile. One loads at a time. */
export async function loadProfile(name: ProfileName): Promise<string> {
  if (name === 'Fresh') return eraseEverything();
  if (isLoading) throw new Error('A profile is loading already. Wait for it to finish.');
  isLoading = true;
  try {
    return await writeProfile(name);
  } finally {
    isLoading = false;
    showUnderWay(null);
  }
}
