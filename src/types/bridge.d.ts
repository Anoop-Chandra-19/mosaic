import type { MosaicDbBridge } from './db';

declare global {
  interface Window {
    /** Exposed by the sandboxed preload (`electron/preload`) — the renderer's only way out. */
    mosaic: {
      platform: string;
      db: MosaicDbBridge;
    };
  }
}

export {};
