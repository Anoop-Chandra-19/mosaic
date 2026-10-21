import { describe, expect, it } from 'vitest';
import { ALL_DEV_SWITCHES_OFF } from '@shared/types/devTools';
import { formatDevWindowTitle, hasSwitchOn } from '../devSwitches';

describe('formatDevWindowTitle', () => {
  it('says DEV, then each switch on in the palette’s order, then what is under way', () => {
    expect(formatDevWindowTitle(ALL_DEV_SWITCHES_OFF, null)).toBe('Mosaic DEV');
    const switches = { ...ALL_DEV_SWITCHES_OFF, reopenView: true, slowMotion: true };
    expect(formatDevWindowTitle(switches, 'Loading Heavy 73%')).toBe(
      'Mosaic DEV · Slow motion ×10 · Reopens this view · Loading Heavy 73%'
    );
    expect(hasSwitchOn(ALL_DEV_SWITCHES_OFF)).toBe(false);
    expect(hasSwitchOn(switches)).toBe(true);
  });
});
