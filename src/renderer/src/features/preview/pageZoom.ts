import { useRef, useState } from 'react';
import { PREVIEW_DEFAULT_ZOOM, clampPreviewZoom, useUiStore } from '@/stores/uiStore';

/**
 * A zoom over a page fitted to its panel's width, which the canvas drives. 1 is the fit.
 * The editor's preview keeps one as a setting; the history view keeps its own while open.
 */
export interface PageZoom {
  zoom: number;
  /** The value as of now: the wheel outpaces renders, so it reads this rather than `zoom`. */
  readZoom: () => number;
  /** Sets the zoom, clamped to the range, and returns what it became. */
  setZoom: (zoom: number) => number;
}

/** The editor preview's zoom, remembered as a setting. */
export function useStoredPreviewZoom(): PageZoom {
  const zoom = useUiStore((s) => s.previewZoom);
  const setPreviewZoom = useUiStore((s) => s.setPreviewZoom);
  return {
    zoom,
    readZoom: () => useUiStore.getState().previewZoom,
    setZoom: (next) => {
      setPreviewZoom(next);
      return useUiStore.getState().previewZoom;
    },
  };
}

/** A zoom of the component's own, starting at fit, gone when it unmounts. */
export function useOwnPageZoom(): PageZoom {
  const [zoom, setZoomState] = useState(PREVIEW_DEFAULT_ZOOM);
  const latest = useRef(PREVIEW_DEFAULT_ZOOM);
  return {
    zoom,
    readZoom: () => latest.current,
    setZoom: (next) => {
      latest.current = clampPreviewZoom(next);
      setZoomState(latest.current);
      return latest.current;
    },
  };
}
