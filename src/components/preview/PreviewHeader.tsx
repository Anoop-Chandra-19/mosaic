import type { ContactInfo } from '@/types/resume';

interface PreviewHeaderProps {
  contact: ContactInfo;
}

function joinNonEmpty(parts: string[]) {
  return parts.filter((part) => part.trim().length > 0).join(' | ');
}

export function PreviewHeader({ contact }: PreviewHeaderProps) {
  const primaryLine = joinNonEmpty([contact.email, contact.phone, contact.location]);
  const secondaryLine = joinNonEmpty([contact.linkedin, contact.github, contact.website]);

  return (
    <header
      className="pb-3 text-center"
      style={{ fontFamily: 'Georgia, serif' }}
      data-preview-header
    >
      <h1 className="text-[clamp(1.6rem,2.7vw,2.1rem)] leading-tight font-bold text-zinc-900">
        {contact.name || 'Your Name'}
      </h1>
      {primaryLine && <p className="mt-1 text-sm text-zinc-700">{primaryLine}</p>}
      {secondaryLine && <p className="mt-0.5 text-sm text-zinc-700">{secondaryLine}</p>}
    </header>
  );
}
