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
import {
  MAX_FILE_BYTES,
  MAX_TEXT_BYTES,
  type FileType,
  type OpenedFile,
} from '@shared/types/files';
import { FILES_OPEN, FILES_SAVE } from '@shared/ipc/appChannels';
import { replaceFileSafely } from '../replaceFileSafely';

const FILTERS: Record<FileType, FileFilter[]> = {
  json: [{ name: 'JSON', extensions: ['json'] }],
  markdown: [{ name: 'Markdown', extensions: ['md'] }],
  text: [{ name: 'Plain text', extensions: ['txt'] }],
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  docx: [{ name: 'Word document', extensions: ['docx'] }],
  import: [
    {
      name: 'Resumes and Mosaic backups',
      extensions: ['pdf', 'docx', 'doc', 'md', 'markdown', 'txt', 'json'],
    },
  ],
};

function filtersFor(type: unknown): FileFilter[] {
  if (typeof type !== 'string' || !Object.hasOwn(FILTERS, type)) {
    throw new Error(`Unknown file type ${String(type)}`);
  }
  return FILTERS[type as FileType];
}

const tooLarge = (name: string, limit: number) =>
  new Error(`${name} is larger than ${Math.floor(limit / 1024 / 1024)} MB`);

/** PDF and Word files are binary; everything else is text that has to fit in one string. */
const openLimitFor = (type: unknown) =>
  type === 'pdf' || type === 'docx' ? MAX_FILE_BYTES : MAX_TEXT_BYTES;

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
    async (event, type: unknown, suggestedName: unknown, content: unknown) => {
      const win = ownWindow(event, FILES_SAVE);
      const filters = filtersFor(type);
      if (
        typeof suggestedName !== 'string' ||
        (typeof content !== 'string' && !(content instanceof Uint8Array))
      ) {
        throw new Error('A file needs a name and content');
      }
      // Bytes as written: a string's length counts UTF-16 units, a third of some text's size.
      const bytes = typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength;
      // Anything larger couldn't be read back.
      if (bytes > MAX_TEXT_BYTES) throw tooLarge(suggestedName, MAX_TEXT_BYTES);

      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        // A name only: the renderer never chooses a folder.
        defaultPath: path.join(app.getPath('documents'), path.basename(suggestedName)),
        filters,
      });
      if (canceled || !filePath) return null;
      await replaceFileSafely(filePath, content);
      return path.basename(filePath);
    }
  );

  ipcMain.handle(FILES_OPEN, async (event, type: unknown): Promise<OpenedFile | null> => {
    const win = ownWindow(event, FILES_OPEN);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filtersFor(type),
    });
    const [filePath] = filePaths;
    if (canceled || !filePath) return null;

    const name = path.basename(filePath);
    const limit = openLimitFor(type);
    if ((await fs.stat(filePath)).size > limit) throw tooLarge(name, limit);
    // Bytes, not text: main never interprets what it reads (a PDF isn't text at all).
    return { name, bytes: new Uint8Array(await fs.readFile(filePath)) };
  });
}
