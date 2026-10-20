import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';
import { DEV_OPEN_TOOLS, HELP_MENU_COMMAND, type HelpMenuCommand } from '@shared/ipc/appChannels';

/** A menu item the page answers: main only passes the choice on. */
function askPage(label: string, command: HelpMenuCommand): MenuItemConstructorOptions {
  return {
    id: command,
    label,
    click: (_item, window) => {
      if (window instanceof BrowserWindow) window.webContents.send(HELP_MENU_COMMAND, command);
    },
  };
}

/**
 * Electron's default menu without its View menu, whose zoom keys (Ctrl/⌘+0, +, −) would
 * zoom the whole window instead of the page in the preview. Edit keeps copy and paste
 * working on macOS. Help opens the shortcuts and About, and copies the view's address for a
 * bug report. Development keeps reload and DevTools on their usual keys, and opens the
 * developer tools; a release has none of them.
 */
export function setAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        askPage('Keyboard shortcuts', 'shortcuts'),
        askPage('Copy view address', 'copyViewAddress'),
        { type: 'separator' },
        askPage('About Mosaic', 'about'),
      ],
    },
  ];
  if (!app.isPackaged) {
    template.push({
      label: 'Develop',
      submenu: [
        {
          id: 'developer-tools',
          label: 'Developer tools…',
          // Shown here, answered by the page, which also sees the keys a test presses.
          accelerator: 'CmdOrCtrl+Shift+D',
          registerAccelerator: false,
          click: (_item, window) => {
            if (window instanceof BrowserWindow) window.webContents.send(DEV_OPEN_TOOLS);
          },
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
