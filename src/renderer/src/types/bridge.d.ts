import type { MosaicAI } from '@shared/types/ai';
import type { MosaicBackup } from '@shared/types/backup';
import type { MosaicDbBridge } from '@shared/types/db';
import type { MosaicFiles } from '@shared/types/files';
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
      ai: MosaicAI;
      app: {
        /**
         * Deletes the API keys, the database file, and everything the page stored. Reload
         * afterwards: the app then boots empty.
         */
        eraseAll(): Promise<void>;
        /** Called when the window is closing; the close waits (up to 2 s) for it to settle. */
        onFlushRequest(flush: () => Promise<void>): void;
      };
    };
  }
}

export {};
