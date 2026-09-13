import type { MosaicDbBridge } from './db';
import type { MosaicFiles } from './files';

declare global {
  interface Window {
    /** Exposed by the sandboxed preload (`electron/preload`) — the renderer's only way out. */
    mosaic: {
      platform: string;
      db: MosaicDbBridge;
      files: MosaicFiles;
      app: {
        /**
         * Deletes the database file and everything the page stored. Reload afterwards: the
         * app then boots empty.
         */
        eraseAll(): Promise<void>;
        /** Called when the window is closing; the close waits (up to 2 s) for it to settle. */
        onFlushRequest(flush: () => Promise<void>): void;
      };
    };
  }
}

export {};
