import { goToPlace } from '@/features/navigation/showPlace';
import { selectTemplateProposals, useProposalStore } from '@/stores/proposalStore';
import { readVersionHistory, useTemplateStore } from '@/stores/templateStore';
import { formatViewAddress } from './formatViewAddress';
import { parseViewAddress } from './parseViewAddress';
import { readCurrentViewPlace } from './readCurrentViewPlace';
import { resolveViewPlace, type Resolution, type ViewLookup } from './resolveViewPlace';
import type { ViewPlace } from './viewPlace';

/*
 * A view's address: where the app is, in words that read back to the same view
 * ("history / Tailored for Kestrel / v12 vs v11 / changes"), for a bug report or to come
 * back to. Copying: `readCurrentViewPlace` (from the stores, and `viewPlaceStore` for inside
 * a surface) → `formatViewAddress`. Going: `parseViewAddress` → `resolveViewPlace` (checked
 * against the templates, their history and the suggestions) → navigation's `goToPlace`. Other modules
 * use this file, `viewPlace.ts`'s types and `formatViewAddress`; release builds ship it for
 * Help › Copy view address.
 */

function lookUpStores(): ViewLookup {
  return {
    templates: useTemplateStore.getState().templates,
    readVersions: readVersionHistory,
    listSuggestionIds: (templateId) =>
      selectTemplateProposals(useProposalStore.getState(), templateId)
        .filter((proposal) => proposal.status !== 'applied')
        .map((proposal) => proposal.id),
  };
}

/** The address of where the app is now. */
export function describeCurrentView(): string {
  return formatViewAddress(readCurrentViewPlace());
}

/** Copies the address of where the app is now, and gives it back. */
export async function copyViewAddress(): Promise<string> {
  const address = describeCurrentView();
  await navigator.clipboard.writeText(address);
  return address;
}

/** Checks a view against what exists, without going there. */
export function checkViewPlace(place: ViewPlace, chosenTemplateId?: string): Promise<Resolution> {
  return resolveViewPlace(place, lookUpStores(), chosenTemplateId);
}

/** Goes to the view if it exists; otherwise says why not, or which templates share its name. */
export async function goToView(place: ViewPlace, chosenTemplateId?: string): Promise<Resolution> {
  const resolution = await checkViewPlace(place, chosenTemplateId);
  if ('resolved' in resolution) await goToPlace(resolution.resolved);
  return resolution;
}

/** `goToView` for an address in words; a part that can't be read comes back as the error. */
export async function goToViewAddress(
  text: string,
  chosenTemplateId?: string
): Promise<Resolution> {
  const parsed = parseViewAddress(text);
  return 'error' in parsed ? parsed : goToView(parsed.place, chosenTemplateId);
}
