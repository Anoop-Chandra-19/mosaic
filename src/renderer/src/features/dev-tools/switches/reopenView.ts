import { describeCurrentView, goToViewAddress } from '@/features/view-address/viewAddress';
import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { showToast } from '@/stores/toastStore';
import { useViewPlaceStore } from '@/stores/viewPlaceStore';

/** Goes back to the view the window was last on; one that is gone says why in a toast. */
export async function reopenLastView(): Promise<void> {
  const address = await window.mosaic.dev?.readReopenAddress();
  if (!address) return;
  const resolution = await goToViewAddress(address);
  if ('error' in resolution) {
    showToast(`Couldn’t reopen “${address}”: ${resolution.error}`, 'error');
  } else if ('sameName' in resolution) {
    showToast(`Couldn’t reopen “${address}”: templates share its name.`, 'error');
  }
}

/** The stores a view's address is read from; a change to any may move it. */
const PLACE_STORES = [useOverlayStore, useViewPlaceStore, useResumeStore, useTemplateStore];

/** Keeps the view's address for the next launch each time it changes, until stopped. */
export function keepViewForReopen(): () => void {
  let kept = '';
  const keep = () => {
    const address = describeCurrentView();
    if (address === kept) return;
    kept = address;
    void window.mosaic.dev?.saveReopenAddress(address);
  };
  keep();
  const stops = PLACE_STORES.map((store) => store.subscribe(keep));
  return () => stops.forEach((stop) => stop());
}
