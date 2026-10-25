import { DEV_SWITCHES, type DevSwitch, type DevToolArgs } from '@shared/types/devTools';
import type { DevTool } from './devTool';
import { setDevSwitch, useDevToolsStore } from '../devToolsStore';
import { DEV_SWITCH_WORDS } from '../switches/devSwitches';

/** On or off as asked (`isOn`), or the other way from now. */
async function flipSwitch(name: DevSwitch, args: DevToolArgs): Promise<string> {
  const isOn =
    typeof args.isOn === 'boolean' ? args.isOn : !useDevToolsStore.getState().switches[name];
  await setDevSwitch(name, isOn);
  return `${DEV_SWITCH_WORDS[name].label} is ${isOn ? 'on' : 'off'}`;
}

export const SWITCH_TOOLS: DevTool[] = DEV_SWITCHES.map((name) => ({
  id: name,
  group: 'Switches',
  label: DEV_SWITCH_WORDS[name].label,
  description: DEV_SWITCH_WORDS[name].description,
  switch: name,
  run: (args) => flipSwitch(name, args),
}));
