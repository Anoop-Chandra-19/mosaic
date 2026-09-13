import fs from 'node:fs/promises';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type FileFilter,
  type IpcMainInvokeEvent,
} from 'electron';
import { MAX_TEXT_FILE_BYTES, type OpenedTextFile, type TextFileType } from '@/types/files';
import { FILES_OPEN, FILES_SAVE } from '../../shared/appChannels';

const FILTERS: Record<TextFileType, FileFilter[]> = {
  json: [{ name: 'JSON', extensions: ['json'] }],
};

function filtersFor(type: unknown): FileFilter[] {
  if (typeof type !== 'string' || !Object.hasOwn(FILTERS, type)) {
    throw new Error(`Unknown file type ${String(type)}`);
  }
  return FILTERS[type as TextFileType];
}

const tooLarge = (name: string) => new Error(`${name} is larger than 128 MB`);

/**
 * `MosaicFiles` — the system Save and Open dialogs. The renderer names a file type and
 * suggests a name; only the user picks where anything is read or written.
 */
export function registerFileHandlers(isAppFrame: (event: IpcMainInvokeEvent) => boolean): void {
  const ownWindow = (event: IpcMainInvokeEvent, channel: string): BrowserWindow => {
    const win = isAppFrame(event) ? BrowserWindow.fromWebContents(event.sender) : null;
    if (!win) throw new Error(`Refused ${channel} from ${event.senderFrame?.url}`);
    return win;
  };

  ipcMain.handle(
    FILES_SAVE,
    async (event, type: unknown, suggestedName: unknown, text: unknown): Promise<string | null> => {
      const win = ownWindow(event, FILES_SAVE);
      const filters = filtersFor(type);
      if (typeof suggestedName !== 'string' || typeof text !== 'string') {
        throw new Error('A file needs a name and text');
      }
      if (text.length > MAX_TEXT_FILE_BYTES) throw tooLarge(suggestedName);

      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        // A name only: the renderer never chooses a folder.
        defaultPath: path.join(app.getPath('documents'), path.basename(suggestedName)),
        filters,
      });
      if (canceled || !filePath) return null;
      await fs.writeFile(filePath, text, 'utf8');
      return path.basename(filePath);
    }
  );

  ipcMain.handle(FILES_OPEN, async (event, type: unknown): Promise<OpenedTextFile | null> => {
    const win = ownWindow(event, FILES_OPEN);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filtersFor(type),
    });
    const [filePath] = filePaths;
    if (canceled || !filePath) return null;

    const name = path.basename(filePath);
    if ((await fs.stat(filePath)).size > MAX_TEXT_FILE_BYTES) throw tooLarge(name);
    return { name, text: await fs.readFile(filePath, 'utf8') };
  });
}
