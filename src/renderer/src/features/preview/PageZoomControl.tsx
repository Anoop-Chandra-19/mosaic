import { Minus, Plus } from 'lucide-react';
import { AppButton } from '@/components/ui-kit';
import { shortcutLabel } from '@/lib/keyboardShortcuts';
import { PREVIEW_ZOOM_RANGE } from '@/stores/uiStore';

/** The editor preview's header has room for `xs`; the history's and the review's float, at `2xs`. */
const SIZES = {
  xs: {
    gap: 'gap-1',
    icon: 'size-3.5',
    readout: 'min-w-9.5 px-0.5 font-regular text-ink-muted tabular-nums',
  },
  '2xs': {
    gap: 'gap-0.5',
    icon: undefined,
    readout: 'min-w-8.5 px-1 font-mono font-regular text-ink-soft tabular-nums',
  },
} as const;

export interface PageZoomControlProps {
  value: number;
  size?: keyof typeof SIZES;
  /** The pane reads the page as text: zooming in shows the page instead. */
  isTextRead?: boolean;
  onStep: (direction: 1 | -1) => void;
  onReset: () => void;
}

/** Out, the zoom as a percentage that resets it, and in: wherever a page can be zoomed. */
export function PageZoomControl({
  value,
  size = '2xs',
  isTextRead = false,
  onStep,
  onReset,
}: PageZoomControlProps) {
  const { gap, icon, readout } = SIZES[size];
  return (
    <span className={`inline-flex items-center ${gap}`}>
      <AppButton
        variant="ghost"
        size={size}
        shape="square"
        aria-label="Zoom out"
        disabled={isTextRead || value <= PREVIEW_ZOOM_RANGE.min}
        onClick={() => onStep(-1)}
      >
        <Minus className={icon} />
      </AppButton>
      <AppButton
        variant="ghost"
        size={size}
        className={readout}
        aria-label="Reset zoom"
        title={
          isTextRead
            ? 'Zoom in to read the printed page'
            : `Reset to fit width. ${shortcutLabel('scroll')} zooms to the pointer, and Space drags the page.`
        }
        disabled={isTextRead}
        onClick={onReset}
      >
        {isTextRead ? 'Text' : `${Math.round(value * 100)}%`}
      </AppButton>
      <AppButton
        variant="ghost"
        size={size}
        shape="square"
        aria-label="Zoom in"
        disabled={value >= PREVIEW_ZOOM_RANGE.max}
        onClick={() => onStep(1)}
      >
        <Plus className={icon} />
      </AppButton>
    </span>
  );
}
