import type { MosaicDbBridge } from './db';

declare global {
  interface Window {
    /** Exposed by the sandboxed preload (`electron/preload`) — the renderer's only way out. */
    mosaic: {
      platform: string;
      db: MosaicDbBridge;
      app: {
        /** Called when the window is closing; the close waits (up to 2 s) for it to settle. */
        onFlushRequest(flush: () => Promise<void>): void;
      };
    };
  }
}

export {};
