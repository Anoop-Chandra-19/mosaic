import type { ContactInfo } from '@/types/resume';

interface PreviewHeaderProps {
  contact: ContactInfo;
  variant?: 'full' | 'compact';
  pageNumber?: number;
}

function joinNonEmpty(parts: string[]) {
  return parts.filter((part) => part.trim().length > 0).join(' | ');
}

function getNameClass(name: string) {
  const length = name.trim().length;

  if (length <= 18) {
    return 'text-[clamp(1.6rem,2.7vw,2.1rem)] leading-tight';
  }

  if (length <= 26) {
    return 'text-[clamp(1.4rem,2.3vw,1.9rem)] leading-tight';
  }

  return 'text-[clamp(1.2rem,2vw,1.6rem)] leading-snug break-words';
}

export function PreviewHeader({ contact, variant = 'full', pageNumber = 1 }: PreviewHeaderProps) {
  const displayName = contact.name?.trim() || 'Your Name';
  const primaryLine = joinNonEmpty([contact.email, contact.phone, contact.location]);
  const secondaryLine = joinNonEmpty([
    contact.showLinkedin !== false ? contact.linkedin : '',
    contact.showGithub !== false ? contact.github : '',
    contact.showWebsite !== false ? contact.website : '',
  ]);

  if (variant === 'compact') {
    const compactLine = joinNonEmpty([contact.email, contact.phone, contact.location]);

    return (
      <header
        className="pb-1.5"
        style={{ fontFamily: '"Source Serif 4", serif' }}
        data-preview-header
        data-preview-header-variant="compact"
      >
        <div className="flex items-center justify-between gap-3 text-[0.68rem] font-semibold tracking-[0.08em] text-zinc-700 uppercase">
          <span className="truncate">{displayName}</span>
          <span>Page {pageNumber}</span>
        </div>
        {compactLine && (
          <p className="mt-0.5 text-[0.72rem] leading-[1.25] text-zinc-600">{compactLine}</p>
        )}
        <div className="mt-1.5 border-b border-zinc-300" />
      </header>
    );
  }

  return (
    <header
      className="pb-3 text-center"
      style={{ fontFamily: '"Source Serif 4", serif' }}
      data-preview-header
      data-preview-header-variant="full"
    >
      <h1 className={`${getNameClass(displayName)} font-bold text-zinc-900`}>{displayName}</h1>
      {primaryLine && (
        <p className="mt-1 text-[0.82rem] leading-[1.3] text-zinc-700">{primaryLine}</p>
      )}
      {secondaryLine && (
        <p className="mt-0.5 text-[0.8rem] leading-[1.25] text-zinc-700">{secondaryLine}</p>
      )}
    </header>
  );
}
