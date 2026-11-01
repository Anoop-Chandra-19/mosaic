/** A developer tool's choices: plain values, so tests can pass the same ones. */
export type DevToolArgs = Record<string, string | number | boolean>;

/** One run of a developer tool, as Recent keeps it: the tool and the choices it ran with. */
export interface DevToolRun {
  toolId: string;
  args: DevToolArgs;
}

/** How many runs Recent keeps. */
export const MAX_RECENT_DEV_RUNS = 4;

/**
 * What stays on until turned off, across launches. Main applies the motion ones, and runs
 * the assistant on the scripted model.
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

/** One process's memory, as Electron reports it. */
export interface ProcessMemory {
  /** "Main", "Window", "GPU", or a utility process's own name: "Network Service". */
  name: string;
  isUtility: boolean;
  /** Its working set. */
  kilobytes: number;
}

/**
 * Development builds only: `window.mosaic.dev`, which a release build doesn't have. Kept by
 * main in the development data folder, never in the database, settings or a backup.
 */
export interface MosaicDev {
  readRecent(): Promise<DevToolRun[]>;
  saveRecent(runs: DevToolRun[]): Promise<void>;
  readSwitches(): Promise<DevSwitches>;
  /** Keeps them, and applies slow and reduced motion to the window at once. */
  saveSwitches(switches: DevSwitches): Promise<void>;
  /** The view's address the window was last on, for Reopen this view at launch. */
  readReopenAddress(): Promise<string | null>;
  saveReopenAddress(address: string): Promise<void>;
  /** What each of Mosaic's processes holds right now. */
  readMemory(): Promise<ProcessMemory[]>;
  /** Writes a conversation of about this many fictional messages. Returns its id. */
  seedLongConversation(messageCount: number): Promise<number>;
  /** The folder the development data is in, with the home folder as `~`. */
  readDataFolder(): Promise<string>;
  /** Develop › Developer tools… was chosen in the menu bar. */
  onOpenTools(open: () => void): void;
}
