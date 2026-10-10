import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
import { LINK_COLORS, LINK_STYLES } from '@shared/resume/resumeHeader';
import type { LinkColor, LinkStyle } from '@shared/types/resume';

/** Link appearance controls; the caller decides whether changes are saved or export-only. */
export function HeaderLinkControls({
  linkStyle,
  linkColor,
  onLinkStyleChange,
  onLinkColorChange,
}: {
  linkStyle: LinkStyle;
  linkColor: LinkColor;
  onLinkStyleChange: (linkStyle: LinkStyle) => void;
  onLinkColorChange: (linkColor: LinkColor) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AppToggleGroup
        type="single"
        value={linkStyle}
        // A single-choice group reports '' when the pressed item is pressed again.
        onValueChange={(value) => value && onLinkStyleChange(value as LinkStyle)}
        aria-label="Header links"
      >
        {LINK_STYLES.map(({ value, label }) => (
          <AppToggleGroupItem key={value} value={value}>
            {label}
          </AppToggleGroupItem>
        ))}
      </AppToggleGroup>
      <AppToggleGroup
        type="single"
        value={linkColor}
        onValueChange={(value) => value && onLinkColorChange(value as LinkColor)}
        aria-label="Header link color"
      >
        {LINK_COLORS.map(({ value, label }) => (
          <AppToggleGroupItem key={value} value={value}>
            {label}
          </AppToggleGroupItem>
        ))}
      </AppToggleGroup>
    </div>
  );
}
