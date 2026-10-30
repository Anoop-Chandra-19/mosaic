import { useEffect } from 'react';
import { copyViewAddress } from '@/features/view-address/viewAddress';
import { appService } from '@/lib/services/appService';
import { useOverlayStore } from '@/stores/overlayStore';
import { attempt, showToast } from '@/stores/toastStore';
import type { HelpMenuCommand } from '@shared/ipc/appChannels';

const HELP_ACTIONS: Record<HelpMenuCommand, () => void> = {
  shortcuts: () => useOverlayStore.getState().openDialog({ kind: 'shortcuts', place: null }),
  copyViewAddress: () =>
    void attempt(
      copyViewAddress().then((address) => showToast(`Copied the view address: ${address}`)),
      'Could not copy the view address'
    ),
  about: () => useOverlayStore.getState().openSettings('about'),
};

/** Answers the menu bar's Help, in every build. */
export function useHelpMenu(): void {
  useEffect(() => {
    appService.onHelpMenu((command) => HELP_ACTIONS[command]());
  }, []);
}
