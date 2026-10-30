import { create } from 'zustand';
import { ALL_DEV_SWITCHES_OFF, type DevSwitch, type DevSwitches } from '@shared/types/devTools';
import { devService } from './devService';

/**
 * What the tools show outside the palette: the switches on, and what is under way (a load),
 * for the window's title and the wrench. Main keeps the switches; this is their copy.
 */
interface DevToolsState {
  switches: DevSwitches;
  /** "Loading Heavy 73%". */
  underWay: string | null;
}

export const useDevToolsStore = create<DevToolsState>()(() => ({
  switches: ALL_DEV_SWITCHES_OFF,
  underWay: null,
}));

export function showUnderWay(underWay: string | null): void {
  useDevToolsStore.setState({ underWay });
}

/** Turns a switch on or off and keeps it, main applying the motion ones at once. */
export async function setDevSwitch(name: DevSwitch, isOn: boolean): Promise<void> {
  const switches = { ...useDevToolsStore.getState().switches, [name]: isOn };
  await devService.saveSwitches(switches);
  useDevToolsStore.setState({ switches });
}
