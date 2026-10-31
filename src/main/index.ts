import { app } from 'electron';
import { closeAppDatabase, getAppDatabase, openAppDatabaseOrQuit } from './db/appDatabase';
import { devLogStep } from './dev/devLog';
import { isDevLogWanted, startDevLog } from './dev/startDevLog';
import { redirectDevProfile } from './devProfile';
import { registerAgentHandlers } from './ipc/registerAgentHandlers';
import { registerBackupHandlers } from './ipc/registerBackupHandlers';
import { registerDbHandlers } from './ipc/registerDbHandlers';
import { registerDevHandlers } from './ipc/registerDevHandlers';
import { registerEraseHandler } from './ipc/registerEraseHandler';
import { registerFileHandlers } from './ipc/registerFileHandlers';
import { registerModelProviderHandlers } from './ipc/registerModelProviderHandlers';
import { registerSecretsHandlers } from './ipc/registerSecretsHandlers';
import { createAppApiKeys } from './secrets/appApiKeys';
import { setAppMenu } from './window/appMenu';
import { isAppFrame } from './window/appPage';
import { openAppWindow } from './window/appWindow';
import {
  focusExistingWindowOnSecondLaunch,
  quitOnceWindowsClose,
  reopenWindowOnActivate,
} from './window/windowLifecycle';

// Main's entry: the boot sequence, and nothing defined here. The database is
// `db/appDatabase`, the IPC handlers `ipc/`, and the window `window/`.

redirectDevProfile();
if (isDevLogWanted()) startDevLog();

// One instance only: SQLite has a single writer, and a second window over the same data
// would race it.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  focusExistingWindowOnSecondLaunch();
  quitOnceWindowsClose();
  app.on('will-quit', closeAppDatabase);

  void app.whenReady().then(() => {
    if (!devLogStep('main', 'database opened', openAppDatabaseOrQuit)) return;
    const apiKeys = createAppApiKeys();
    registerDbHandlers(getAppDatabase, isAppFrame);
    registerFileHandlers(isAppFrame);
    registerBackupHandlers(getAppDatabase, isAppFrame);
    registerModelProviderHandlers(getAppDatabase, isAppFrame);
    registerSecretsHandlers(apiKeys, isAppFrame);
    const readDevSwitches = app.isPackaged ? null : registerDevHandlers(isAppFrame);
    const agentRuns = registerAgentHandlers(getAppDatabase, apiKeys, isAppFrame, readDevSwitches);
    registerEraseHandler(apiKeys, agentRuns, isAppFrame);
    setAppMenu();
    openAppWindow();
    reopenWindowOnActivate();
  });
}
