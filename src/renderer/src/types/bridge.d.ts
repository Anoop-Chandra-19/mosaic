import type { MosaicAgent } from '@shared/types/agentBridge';
import type { MosaicBackup } from '@shared/types/backup';
import type { HelpMenuCommand } from '@shared/ipc/appChannels';
import type { MosaicDbBridge } from '@shared/types/dbBridge';
import type { MosaicDev } from '@shared/types/devTools';
import type { MosaicFiles } from '@shared/types/files';
import type { MosaicModelProviders } from '@shared/types/modelProviders';
import type { MosaicSecrets } from '@shared/types/secrets';

declare global {
  interface Window {
    /** Exposed by the sandboxed preload (`src/preload`) — the renderer's only way out. */
    mosaic: {
      platform: string;
      db: MosaicDbBridge;
      files: MosaicFiles;
      backup: MosaicBackup;
      secrets: MosaicSecrets;
      modelProviders: MosaicModelProviders;
      agent: MosaicAgent;
      /** Development builds only. */
      dev?: MosaicDev;
      app: {
        /**
         * Deletes the API keys, the database file, and everything the page stored. Reload
         * afterwards: the app then boots empty.
         */
        eraseAll(): Promise<void>;
        /**
         * Called when the window is closing; the close waits (up to 2 s) for it to settle,
         * and asks first when it resolves false: the draft couldn't be saved.
         */
        onFlushRequest(flush: () => Promise<boolean>): void;
        /** A Help menu item was chosen. */
        onHelpMenu(answer: (command: HelpMenuCommand) => void): void;
      };
    };
  }
}

export {};
