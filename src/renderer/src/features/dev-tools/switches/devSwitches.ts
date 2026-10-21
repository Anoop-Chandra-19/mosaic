import { DEV_SWITCHES, type DevSwitch, type DevSwitches } from '@shared/types/devTools';

interface DevSwitchWords {
  label: string;
  description: string;
  /** In the window's title while it is on. */
  titleName: string;
}

export const DEV_SWITCH_WORDS: Record<DevSwitch, DevSwitchWords> = {
  slowMotion: {
    label: 'Slow motion',
    description: 'Every animation 10 times slower.',
    titleName: 'Slow motion ×10',
  },
  reducedMotion: {
    label: 'Reduced motion',
    description: 'As if the system setting were on.',
    titleName: 'Reduced motion',
  },
  outlineBoxes: {
    label: 'Outline measured boxes',
    description: 'Draws the boxes pagination measures, on the page.',
    titleName: 'Outlines',
  },
  reopenView: {
    label: 'Reopen this view at launch',
    description: 'Every launch of this build goes back to the view it closed on.',
    titleName: 'Reopens this view',
  },
};

export const hasSwitchOn = (switches: DevSwitches) => DEV_SWITCHES.some((name) => switches[name]);

/** "Mosaic DEV · Slow motion ×10 · Loading Heavy 73%": the switches on, then what is under way. */
export function formatDevWindowTitle(switches: DevSwitches, underWay: string | null): string {
  const switchesOn = DEV_SWITCHES.filter((name) => switches[name]).map(
    (name) => DEV_SWITCH_WORDS[name].titleName
  );
  return ['Mosaic DEV', ...switchesOn, ...(underWay ? [underWay] : [])].join(' · ');
}
