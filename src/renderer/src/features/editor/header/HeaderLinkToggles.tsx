import { HeaderLinkControls } from '@/components/HeaderLinkControls';
import { useResumeStore } from '@/stores/resumeStore';

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
    <HeaderLinkControls
      linkStyle={linkStyle}
      linkColor={linkColor}
      onLinkStyleChange={setLinkStyle}
      onLinkColorChange={setLinkColor}
    />
  );
}
