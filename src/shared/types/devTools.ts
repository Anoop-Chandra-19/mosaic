/** Developer tool arguments. Tests use the same value types. */
export type DevToolArgs = Record<string, string | number | boolean>;

/** Tool ID and arguments saved in Recent for a developer tool run. */
export interface DevToolRun {
  toolId: string;
  args: DevToolArgs;
}

/** Maximum number of developer tool runs saved in Recent. */
export const MAX_RECENT_DEV_RUNS = 4;

/**
 * Developer switches saved across launches until turned off. Main applies the motion
 * settings and uses the scripted model when that switch is on.
 */
export const DEV_SWITCHES = [
  'slowMotion',
  'reducedMotion',
  'outlineBoxes',
  'reopenView',
  'scriptedModel',
] as const;
export type DevSwitch = (typeof DEV_SWITCHES)[number];
export type DevSwitches = Record<DevSwitch, boolean>;

export const ALL_DEV_SWITCHES_OFF: DevSwitches = {
  slowMotion: false,
  reducedMotion: false,
  outlineBoxes: false,
  reopenView: false,
  scriptedModel: false,
};

/** Memory usage for one process, as reported by Electron. */
export interface ProcessMemory {
  /** "Main", "Window", "GPU", or a utility process's own name: "Network Service". */
  name: string;
  isUtility: boolean;
  /** Working-set memory in kilobytes. */
  kilobytes: number;
}

/**
 * `window.mosaic.dev` is available only in development builds. Main saves developer tool
 * state in the development data folder, not in the database, settings, or backups.
 */
export interface MosaicDev {
  readRecent(): Promise<DevToolRun[]>;
  saveRecent(runs: DevToolRun[]): Promise<void>;
  readSwitches(): Promise<DevSwitches>;
  /** Saves the switches and immediately applies slow and reduced motion to the window. */
  saveSwitches(switches: DevSwitches): Promise<void>;
  /** Last view address saved for the Reopen this view at launch switch. */
  readReopenAddress(): Promise<string | null>;
  saveReopenAddress(address: string): Promise<void>;
  /** Current memory usage for each Mosaic process. */
  readMemory(): Promise<ProcessMemory[]>;
  /** Writes a conversation of about this many fictional messages. Returns its id. */
  seedLongConversation(messageCount: number): Promise<number>;
  /** Development data folder path, with the home folder replaced by `~`. */
  readDataFolder(): Promise<string>;
  /** Registers a callback for the Develop › Developer tools… menu item. */
  onOpenTools(open: () => void): void;
}
