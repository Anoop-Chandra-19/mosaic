import { useState, type ReactNode } from 'react';
import {
  AlignLeft,
  Braces,
  Copy,
  Database,
  Download,
  FileText,
  TriangleAlert,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { AppButton } from '@/components/AppButton';
import { AppDialog, AppDialogContent } from '@/components/AppDialog';
import { AppInput } from '@/components/AppInput';
import { AppRadioGroup, AppRadioGroupItem } from '@/components/AppRadioGroup';
import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { buildExportName, toFileName } from '@/lib/files/fileNames';
import { HeaderLinkToggles } from '@/features/editor/header/HeaderLinkToggles';
import { describeLinkLook } from '@shared/resume/resumeHeader';
import { cn } from '@/lib/utils';
import {
  explainFailure,
  showToast,
  useOverlayStore,
  type ExportVersion,
} from '@/stores/overlayStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import type { PaperSize } from '@/types/paper';
import {
  copyText,
  EXPORT_FORMATS,
  renderExport,
  type ExportFormat,
  type ExportFormatInfo,
} from './exportResume';
import { normalizeResumeForExport } from './normalizeResumeExport';
import { findCharactersPdfCannotDraw } from './pdf/findCharactersPdfCannotDraw';

const FORMAT_ICONS: Record<ExportFormat, LucideIcon> = {
  pdf: FileText,
  docx: FileText,
  markdown: AlignLeft,
  plaintext: Type,
  'json-resume': Braces,
  'mosaic-json': Database,
};

/** Save the open draft, or one version, as a file — or copy it as text. */
export function ExportDialog() {
  const open = useOverlayStore((s) => s.exportOpen);
  const version = useOverlayStore((s) => s.exportVersion);
  const closeExport = useOverlayStore((s) => s.closeExport);

  return (
    <AppDialog open={open} onOpenChange={(next) => !next && closeExport()}>
      <AppDialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-[min(40rem,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        {/* Mounted per opening, so the format and file name start fresh each time. */}
        {open && <ExportForm version={version} onDone={closeExport} />}
      </AppDialogContent>
    </AppDialog>
  );
}

function ExportForm({ version, onDone }: { version: ExportVersion | null; onDone: () => void }) {
  const draftContactName = useResumeStore((s) => s.contact.name);
  const templateId = useResumeStore((s) => s.templateId);
  const activeTemplate = useActiveTemplate();
  const paperSize = useUiStore((s) => s.paperSize);
  const setPaperSize = useUiStore((s) => s.setPaperSize);

  // A version is exported as it was; Mosaic JSON is a template's whole history, so it only
  // goes with the draft.
  const formats = version
    ? EXPORT_FORMATS.filter((format) => format.id !== 'mosaic-json')
    : EXPORT_FORMATS;
  const [formatId, setFormatId] = useState<ExportFormat>('pdf');
  const format = EXPORT_FORMATS.find((f) => f.id === formatId)!;
  const [name, setName] = useState(() =>
    buildExportName(
      version
        ? {
            contactName: version.version.doc.contact.name,
            templateName: version.templateName,
            versionLabel: version.label,
          }
        : { contactName: draftContactName, templateName: activeTemplate?.name }
    )
  );
  const [busy, setBusy] = useState<'save' | 'copy' | null>(null);
  // Mosaic JSON is a backup: it holds the whole template either way.
  const [includeHidden, setIncludeHidden] = useState(false);
  const holdsEverything = format.id === 'mosaic-json';
  const options = { paperSize, includeHidden: includeHidden && !holdsEverything };

  const source = () => ({
    doc: version ? version.version.doc : getResumeSnapshot(),
    templateId: version ? null : templateId,
  });

  const save = async () => {
    setBusy('save');
    const fileName = toFileName(name, format.extension);
    try {
      const content = await renderExport(format.id, source(), options);
      const saved = await window.mosaic.files.save(format.fileType, fileName, content);
      // Cancelled: stay, so a different name or format is one click away.
      if (saved === null) return;
      showToast(`Saved ${saved}`);
      onDone();
    } catch (error) {
      showToast(explainFailure(error, `Could not save ${fileName}`), 'error');
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    setBusy('copy');
    try {
      const content = await renderExport(format.id, source(), options);
      if (typeof content !== 'string') throw new Error(`${format.name} is not text`);
      await copyText(content);
      showToast(`${format.name} copied`);
      onDone();
    } catch (error) {
      console.error(error);
      showToast('Could not copy to the clipboard', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <DialogFrameHeader
        icon={Download}
        title={version ? `Export ${version.label}` : 'Export'}
        description={
          version
            ? `Save ${version.label} of ${version.templateName} as a file, or copy it.`
            : 'Save this resume as a file, or copy it.'
        }
        closeLabel="Close export"
        onClose={onDone}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3.5 pb-1">
        {version && (
          <p className="mb-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {version.label} of {version.templateName}, “{version.version.summary}”, as it was then
            and not your draft.
          </p>
        )}

        <AppRadioGroup
          value={formatId}
          onValueChange={(value) => setFormatId(value as ExportFormat)}
          aria-label="Format"
          className="grid gap-2 sm:grid-cols-2"
        >
          {formats.map((option) => (
            <FormatOption key={option.id} format={option} selected={option.id === formatId} />
          ))}
        </AppRadioGroup>
        {format.id === 'pdf' && (
          <PdfFontNote
            characters={findCharactersPdfCannotDraw(
              normalizeResumeForExport(source().doc, { includeHidden })
            )}
          />
        )}

        <div className="mt-2">
          <Row
            label="Content"
            description={
              holdsEverything
                ? 'A Mosaic JSON backup holds the whole template, hidden content included.'
                : 'Hidden sections, entries, bullets and header items stay in your resume either way.'
            }
          >
            {!holdsEverything && (
              <AppToggleGroup
                type="single"
                value={includeHidden ? 'all' : 'shown'}
                onValueChange={(value) => value && setIncludeHidden(value === 'all')}
                aria-label="Content"
              >
                <AppToggleGroupItem value="shown">What’s on the page</AppToggleGroupItem>
                <AppToggleGroupItem value="all">Everything</AppToggleGroupItem>
              </AppToggleGroup>
            )}
          </Row>
          {format.isPaged && (
            <Row label="Paper">
              <AppToggleGroup
                type="single"
                value={paperSize}
                onValueChange={(value) => value && setPaperSize(value as PaperSize)}
                aria-label="Paper"
              >
                <AppToggleGroupItem value="a4">A4</AppToggleGroupItem>
                <AppToggleGroupItem value="letter">Letter</AppToggleGroupItem>
              </AppToggleGroup>
            </Row>
          )}
          <Row label="Header links" description={format.headerLinkNote}>
            {format.isPaged && <HeaderLinksControl version={version} />}
          </Row>
          <Row label="File name">
            <div className="flex w-[min(18rem,100%)]">
              <AppInput
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label="File name"
                className="rounded-r-none font-mono text-meta"
              />
              <span className="grid h-8 shrink-0 place-items-center rounded-r-sm border border-l-0 border-line-strong bg-line px-2 font-mono text-meta text-ink-muted">
                .{format.extension}
              </span>
            </div>
          </Row>
        </div>
      </div>

      <DialogFrameFooter note="Files are made on your computer; nothing is uploaded.">
        <AppButton variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </AppButton>
        {format.copyable && (
          <AppButton
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void copy()}
          >
            <Copy />
            Copy to clipboard
          </AppButton>
        )}
        <AppButton size="sm" disabled={busy !== null} onClick={() => void save()}>
          <Download />
          {busy === 'save' ? 'Saving…' : `Save ${format.extension.toUpperCase()}`}
        </AppButton>
      </DialogFrameFooter>
    </>
  );
}

const LISTED_CHARACTERS = 8;

/** The PDF's built-in font draws Western European text only; it says so before saving. */
function PdfFontNote({ characters }: { characters: string[] }) {
  if (characters.length === 0) return null;
  const listed = characters.slice(0, LISTED_CHARACTERS).join(' ');
  const more = characters.length - LISTED_CHARACTERS;
  return (
    <p
      role="status"
      className="mt-2 flex items-start gap-1.5 rounded-md border border-line-strong bg-pane-sunken px-2.5 py-2 text-xs leading-relaxed text-ink-soft"
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
      <span>
        The PDF can’t show <span className="font-medium text-foreground">{listed}</span>
        {more > 0 && ` and ${more} more`}. Its built-in font doesn’t have them, so they would print
        as other characters. The Word export shows them.
      </span>
    </p>
  );
}

function FormatOption({ format, selected }: { format: ExportFormatInfo; selected: boolean }) {
  const Icon = FORMAT_ICONS[format.id];
  const id = `export-format-${format.id}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors',
        selected
          ? 'border-amber-500 bg-zinc-50 dark:border-amber-600 dark:bg-zinc-900'
          : 'border-line hover:bg-zinc-50 dark:hover:bg-zinc-900'
      )}
    >
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-md border',
          selected
            ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400'
            : 'border-line-strong bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {format.name}
          {format.id === 'pdf' && (
            <span className="rounded border border-line-strong px-1 text-[0.65rem] leading-4 font-medium text-zinc-500">
              default
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-600 dark:text-zinc-400">
          {format.description}
        </span>
      </span>
      <AppRadioGroupItem id={id} value={format.id} className="mt-0.5" />
    </label>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1 basis-60">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-zinc-600 dark:text-zinc-400">
            {description}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

/**
 * How the header's links look in the PDF and the Word file. It is the resume's own setting, so the draft's
 * can be changed here; a version shows the one it was saved with.
 */
function HeaderLinksControl({ version }: { version: ExportVersion | null }) {
  if (version) {
    return (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {describeLinkLook(version.version.doc.contact.header)}
      </span>
    );
  }
  return <HeaderLinkToggles />;
}
