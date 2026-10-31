import path from 'node:path';
import { app, ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { devLog, turnOnDevLog } from './devLog';
import { formatHomePath } from './formatHomePath';
import { withBridgeLog } from './logBridgeCalls';

/*
 * What the development log watches from outside, so the code being watched doesn't change:
 * every bridge call, the page's errors, and the app's own. It runs only for `bun run dev`
 * (`isDevLogWanted`). A launch that names its own profile, as e2e does, stays quiet unless
 * it asks with --dev-log.
 */

const MAX_PAGE_MESSAGE_LENGTH = 2000;

export const isDevLogWanted = (): boolean =>
  !app.isPackaged &&
  (!app.commandLine.hasSwitch('user-data-dir') || app.commandLine.hasSwitch('dev-log'));

/** Must run before the handlers register, so each is wrapped as it does. */
function logBridgeCalls(): void {
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, answer) =>
    handle(channel, withBridgeLog<[IpcMainInvokeEvent, ...unknown[]], unknown>(channel, answer));
}

function watchPage(page: WebContents): void {
  page.on('console-message', ({ level, message, lineNumber, sourceId }) => {
    if (level !== 'warning' && level !== 'error') return;
    devLog(
      'page',
      // A console's %c marks style what follows, and mean nothing as text.
      message.replaceAll('%c', '').slice(0, MAX_PAGE_MESSAGE_LENGTH),
      { source: sourceId ? path.basename(sourceId.split('?')[0]) : undefined, line: lineNumber },
      level === 'error' ? 'error' : 'warn'
    );
  });
  page.on('preload-error', (_event, preloadPath, error) =>
    devLog(
      'preload',
      'preload failed',
      { file: path.basename(preloadPath), error: error.message },
      'error'
    )
  );
  page.on('render-process-gone', (_event, { reason }) =>
    devLog('page', 'page process gone', { reason }, 'error')
  );
  page.on('did-fail-load', (_event, code, description) =>
    devLog('page', 'page failed to load', { code, reason: description }, 'error')
  );
  page.on('did-finish-load', () => devLog('page', 'page loaded'));
}

function watchApp(): void {
  // The monitor only listens: an uncaught error still does what it would have.
  process.on('uncaughtExceptionMonitor', (error) =>
    devLog('main', 'uncaught error', { error: error.message, stack: error.stack }, 'error')
  );
  process.on('unhandledRejection', (reason) =>
    devLog('main', 'unhandled rejection', { error: String(reason) }, 'error')
  );
  app.on('web-contents-created', (_event, page) => {
    devLog('main', 'window opened');
    watchPage(page);
  });
  app.on('before-quit', () => devLog('main', 'quitting'));
  app.on('will-quit', () => devLog('main', 'quit'));
}

export function startDevLog(): void {
  turnOnDevLog();
  // Chromium's own errors (a frame's latency, no D-Bus) are about Chromium, and drown the log.
  // What the page says still arrives, through its console.
  app.commandLine.appendSwitch('log-level', '3');
  devLog('main', 'started', {
    electron: process.versions.electron,
    dataFolder: formatHomePath(app.getPath('userData')),
  });
  logBridgeCalls();
  watchApp();
}
