import type { ElectronApplication } from '@playwright/test';

/*
 * Stand-ins for the system Save and Open dialogs, which a headless run cannot click. They
 * replace Electron's `dialog` methods in the app's main process, so everything past the
 * dialog — main writing or reading the file — runs for real.
 */

/** Answers Save dialogs by saving into `dir` under the name the app suggested. */
export async function saveInto(app: ElectronApplication, dir: string): Promise<void> {
  await app.evaluate(({ dialog }, folder) => {
    dialog.showSaveDialog = (async (...args: unknown[]) => {
      const { defaultPath = '' } = args.at(-1) as { defaultPath?: string };
      return { canceled: false, filePath: `${folder}/${defaultPath.split(/[\\/]/).pop()}` };
    }) as never;
  }, dir);
}

/** Answers Open dialogs with `file`, as if the user picked it. */
export async function openWith(app: ElectronApplication, file: string): Promise<void> {
  await app.evaluate(({ dialog }, picked) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [picked] })) as never;
  }, file);
}
