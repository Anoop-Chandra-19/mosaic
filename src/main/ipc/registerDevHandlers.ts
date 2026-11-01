import path from 'node:path';
import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { DEV_CHANNELS } from '@shared/ipc/appChannels';
import { ALL_DEV_SWITCHES_OFF, type DevSwitches } from '@shared/types/devTools';
import { databaseFile, getAppDatabase } from '../db/appDatabase';
import { applyDevMotion } from '../dev/applyDevMotion';
import { describeProcessMemory, type PageProcess } from '../dev/describeProcessMemory';
import { formatHomePath } from '../dev/formatHomePath';
import { seedLongConversation } from '../dev/seedLongConversation';
import {
  parseDevSwitches,
  parseDevToolRuns,
  parseReopenAddress,
  parseSeedMessageCount,
  readDevToolsFile,
  updateDevToolsFile,
} from './devHandlers';

function findPageProcess(pid: number): PageProcess | undefined {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.webContents.getOSProcessId() === pid) return 'window';
    if (window.webContents.devToolsWebContents?.getOSProcessId() === pid) return 'devTools';
  }
  return undefined;
}

function reportMotionFailure(error: unknown): void {
  console.error('Developer tools could not apply slow or reduced motion:', error);
}

/**
 * Answer the preload's `dev` calls, from the app's own page only, and give every window the
 * motion switches kept on. Development builds only. Returns the switches as they stand, for
 * main's own code to read at once.
 */
export function registerDevHandlers(
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): () => DevSwitches {
  const file = path.join(app.getPath('userData'), 'dev-tools.json');
  let switchesNow = ALL_DEV_SWITCHES_OFF;
  let hasSavedSwitches = false;
  void readDevToolsFile(file).then(({ switches }) => {
    if (!hasSavedSwitches) switchesNow = switches;
  });
  const refuseOthers = (event: IpcMainInvokeEvent) => {
    if (!isAppFrame(event)) {
      throw new Error(`Refused developer tools from ${event.senderFrame?.url}`);
    }
  };
  const applyKeptMotion = async (page: WebContents) => {
    const { switches } = await readDevToolsFile(file);
    await applyDevMotion(page, switches);
  };

  app.on('browser-window-created', (_event, window) => {
    applyKeptMotion(window.webContents).catch(reportMotionFailure);
  });
  ipcMain.handle(DEV_CHANNELS.readRecent, async (event) => {
    refuseOthers(event);
    return (await readDevToolsFile(file)).recent;
  });
  ipcMain.handle(DEV_CHANNELS.saveRecent, (event, runs: unknown) => {
    refuseOthers(event);
    return updateDevToolsFile(file, { recent: parseDevToolRuns(runs) });
  });
  ipcMain.handle(DEV_CHANNELS.readSwitches, async (event) => {
    refuseOthers(event);
    return (await readDevToolsFile(file)).switches;
  });
  ipcMain.handle(DEV_CHANNELS.saveSwitches, async (event, value: unknown) => {
    refuseOthers(event);
    const switches = parseDevSwitches(value);
    await updateDevToolsFile(file, { switches });
    switchesNow = switches;
    hasSavedSwitches = true;
    await applyDevMotion(event.sender, switches);
  });
  ipcMain.handle(DEV_CHANNELS.readReopenAddress, async (event) => {
    refuseOthers(event);
    return (await readDevToolsFile(file)).reopenAddress;
  });
  ipcMain.handle(DEV_CHANNELS.saveReopenAddress, (event, address: unknown) => {
    refuseOthers(event);
    return updateDevToolsFile(file, { reopenAddress: parseReopenAddress(address) });
  });
  ipcMain.handle(DEV_CHANNELS.readMemory, (event) => {
    refuseOthers(event);
    return describeProcessMemory(app.getAppMetrics(), findPageProcess);
  });
  ipcMain.handle(DEV_CHANNELS.seedLongConversation, (event, messageCount: unknown) => {
    refuseOthers(event);
    const db = getAppDatabase();
    if (!db) throw new Error('The database is not open');
    return seedLongConversation(db, parseSeedMessageCount(messageCount));
  });
  ipcMain.handle(DEV_CHANNELS.readDataFolder, (event) => {
    refuseOthers(event);
    return formatHomePath(path.dirname(databaseFile()));
  });
  return () => switchesNow;
}
