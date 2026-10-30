import type { HelpMenuCommand } from '@shared/ipc/appChannels';

/* The window's own conversation with main: closing, the Help menu, and Erase. */
export const appService = {
  /** Main asks before the window closes; answer once pending saves have landed. */
  onFlushRequest: (flush: () => Promise<boolean>) => window.mosaic.app.onFlushRequest(flush),
  onHelpMenu: (answer: (command: HelpMenuCommand) => void) => window.mosaic.app.onHelpMenu(answer),
  /** Main forgets the keys first, then deletes the database. */
  eraseAll: () => window.mosaic.app.eraseAll(),
};
