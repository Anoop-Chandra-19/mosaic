import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LINK_COLORS, LINK_STYLES } from '@shared/resume/resumeHeader';
import { useResumeStore } from '@/stores/resumeStore';
import type { LinkColor, LinkStyle } from '@shared/types/resume';

/**
 * How the open resume's header links print: underlined or not, black or blue. They are the
 * resume's own settings, so the preview, the PDF, and every place offering them agree.
 */
export function HeaderLinkToggles() {
  const linkStyle = useResumeStore((s) => s.contact.header.linkStyle);
  const linkColor = useResumeStore((s) => s.contact.header.linkColor ?? 'ink');
  const setLinkStyle = useResumeStore((s) => s.setLinkStyle);
  const setLinkColor = useResumeStore((s) => s.setLinkColor);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={linkStyle}
        // A single-choice group reports '' when the pressed item is pressed again.
        onValueChange={(value) => value && setLinkStyle(value as LinkStyle)}
        aria-label="Header links"
      >
        {LINK_STYLES.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={linkColor}
        onValueChange={(value) => value && setLinkColor(value as LinkColor)}
        aria-label="Header link color"
      >
        {LINK_COLORS.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
