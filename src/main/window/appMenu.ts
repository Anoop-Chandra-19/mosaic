import { app, Menu, type MenuItemConstructorOptions } from 'electron';

/**
 * Electron's default menu without its View menu, whose zoom keys (Ctrl/⌘+0, +, −) would
 * zoom the whole window instead of the page in the preview. Edit keeps copy and paste
 * working on macOS. Development keeps reload and DevTools on their usual keys; a release
 * has neither.
 */
export function setAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ];
  if (!app.isPackaged) {
    template.push({ label: 'Develop', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }] });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
