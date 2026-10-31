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
import {
  DialogFrameFooter,
  DialogFrameHeader,
  AppButton,
  AppDialog,
  AppDialogContent,
  AppInput,
  AppRadioGroup,
  AppRadioGroupItem,
  AppToggleGroup,
  AppToggleGroupItem,
  Note,
  Chip,
  Text,
} from '@/components/ui-kit';
import { CHOICE_CARD_CLASSES } from '@/components/kit/controlStyles';
import { useActiveTemplate } from '@/stores/useActiveTemplate';
import { buildExportName, toFileName } from '@/lib/files/fileNames';
import { filesService } from '@/lib/services/filesService';
import { HeaderLinkControls } from '@/components/HeaderLinkControls';
import { describeLinkLook } from '@shared/resume/resumeHeader';
import { easeHeightChanges } from '@/lib/motion/easeHeightChanges';
import { cn } from '@/lib/utils';
import { useDialog, useOverlayStore, type ExportVersion } from '@/stores/overlayStore';
import { explainFailure, showToast } from '@/stores/toastStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import type { PaperSize } from '@/types/paper';
import type { LinkColor, LinkStyle } from '@shared/types/resume';
import {
  copyText,
  EXPORT_FORMATS,
  renderExport,
  type ExportFormat,
  type ExportFormatInfo,
} from './exportResume';
import { normalizeResumeForExport } from '@/lib/resume/normalizeResumeExport';
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
  const { isOpen: open, request } = useDialog('export');
  const version = request?.version ?? null;
  const closeDialog = useOverlayStore((s) => s.closeDialog);
  const closeExport = () => closeDialog('export');

  return (
    <AppDialog open={open} onOpenChange={(next) => !next && closeExport()}>
      <AppDialogContent
        ref={easeHeightChanges}
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
  const [paperSize, setPaperSize] = useState(() => useUiStore.getState().paperSize);
  const [linkStyle, setLinkStyle] = useState<LinkStyle>(
    () => (version?.version.doc ?? getResumeSnapshot()).contact.header.linkStyle
  );
  const [linkColor, setLinkColor] = useState<LinkColor>(
    () => (version?.version.doc ?? getResumeSnapshot()).contact.header.linkColor ?? 'ink'
  );

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
  const options = {
    paperSize,
    includeHidden: includeHidden && !holdsEverything,
    headerLinks: { linkStyle, linkColor },
  };

  const source = () => ({
    doc: version ? version.version.doc : getResumeSnapshot(),
    templateId: version ? null : templateId,
  });

  const save = async () => {
    setBusy('save');
    const fileName = toFileName(name, format.extension);
    try {
      const content = await renderExport(format.id, source(), options);
      const saved = await filesService.save(format.fileType, fileName, content);
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3.5 pb-1 [scrollbar-gutter:stable]">
        {version && (
          <Text as="p" variant="secondary" className="mb-3">
            {version.label} of {version.templateName}, “{version.version.summary}”, as it was then
            and not your draft.
          </Text>
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
        <PdfFontNote
          characters={
            format.id === 'pdf'
              ? findCharactersPdfCannotDraw(
                  normalizeResumeForExport(source().doc, { includeHidden })
                )
              : []
          }
        />

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
            <Row label="Paper" description="For this export only; your preview stays unchanged.">
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
          <Row
            label="Header links"
            description={
              format.isPaged && !version
                ? `${format.headerLinkNote} Changes apply to this export only.`
                : format.headerLinkNote
            }
          >
            {format.isPaged &&
              (version ? (
                <Text variant="body" className="text-ink-muted">
                  {describeLinkLook(version.version.doc.contact.header)}
                </Text>
              ) : (
                <HeaderLinkControls
                  linkStyle={linkStyle}
                  linkColor={linkColor}
                  onLinkStyleChange={setLinkStyle}
                  onLinkColorChange={setLinkColor}
                />
              ))}
          </Row>
          <Row label="File name" className="grid grid-cols-[minmax(5rem,1fr)_minmax(0,26rem)]">
            <div className="flex min-w-0">
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
  const listed = characters.slice(0, LISTED_CHARACTERS).join(' ');
  const more = characters.length - LISTED_CHARACTERS;
  return (
    <Note
      isShown={characters.length > 0}
      icon={TriangleAlert}
      tone="warn"
      size="sm"
      role="status"
      className="mt-2"
    >
      The PDF can’t show <span className="font-strong text-foreground">{listed}</span>
      {more > 0 && ` and ${more} more`}. Its built-in font doesn’t have them, so they would print as
      other characters. The Word export shows them.
    </Note>
  );
}

function FormatOption({ format, selected }: { format: ExportFormatInfo; selected: boolean }) {
  const Icon = FORMAT_ICONS[format.id];
  const id = `export-format-${format.id}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        CHOICE_CARD_CLASSES.base,
        selected ? CHOICE_CARD_CLASSES.chosen : CHOICE_CARD_CLASSES.idle
      )}
    >
      <span
        className={cn(
          'grid size-6.5 shrink-0 place-items-center rounded-[0.4375rem] border',
          selected
            ? 'border-amber-line bg-amber-soft text-amber'
            : 'border-line-strong bg-line text-ink-muted'
        )}
      >
        <Icon className="size-3.25" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <Text variant="secondary" className="font-strong text-foreground">
            {format.name}
          </Text>
          {format.id === 'pdf' && <Chip size="sm">default</Chip>}
        </span>
        <Text variant="secondary" className="mt-0.5 block">
          {format.description}
        </Text>
      </span>
      <AppRadioGroupItem id={id} value={format.id} className="mt-0.5" />
    </label>
  );
}

function Row({
  label,
  description,
  className,
  children,
}: {
  label: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-b-0',
        className
      )}
    >
      <span className="min-w-0 flex-1 basis-60">
        <Text variant="body" className="block font-control text-foreground">
          {label}
        </Text>
        {description && (
          <Text variant="secondary" className="mt-0.75 block">
            {description}
          </Text>
        )}
      </span>
      {children}
    </div>
  );
}
