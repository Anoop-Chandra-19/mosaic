import { goToView } from '@/features/view-address/viewAddress';
import { showProgressToast } from '@/stores/toastStore';
import { useTemplateStore } from '@/stores/templateStore';
import { formatBundleText } from '@shared/vault/formatBundle';
import { showDevWindowTitle } from '../devWindowTitle';
import { generateProfile, type GeneratedProfileName, type ProfileName } from './profiles';

let isLoading = false;

/** As Settings' Erase does: everything goes, and the app starts again as on first run. */
async function eraseEverything(): Promise<string> {
  await window.mosaic.app.eraseAll();
  window.location.reload();
  return '';
}

function showLoading(name: ProfileName, detail: string, percent: number | null): void {
  showProgressToast(`Loading ${name}`, { detail, percent });
  showDevWindowTitle(percent === null ? `Loading ${name}` : `Loading ${name} ${percent}%`);
}

/**
 * Generated in the page, then written as a backup restored over everything, in one
 * transaction: a failure leaves the data as it was. Opens the first template on its own.
 */
async function writeProfile(name: GeneratedProfileName): Promise<string> {
  const startedAt = performance.now();
  const bundle = await generateProfile(name, Date.now(), (done) =>
    showLoading(name, 'generating templates', Math.round(done * 100))
  );
  showLoading(name, 'writing', null);
  // Nothing open over a template the restore takes away.
  await goToView({ kind: 'start' });
  await useTemplateStore.getState().importBundle(formatBundleText(bundle), 'restore-all');
  const [first] = bundle.templates;
  await goToView({ kind: 'editor', template: first.template.name }, first.template.id);
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  return `Loaded ${name} in ${seconds}s. ${bundle.templates.length} templates, ${first.versions.length} versions on ${first.template.name}.`;
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
    showDevWindowTitle();
  }
}
