import { useState, type ReactNode } from 'react';
import {
  AlignLeft,
  Braces,
  Copy,
  Database,
  Download,
  FileText,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { AppButton } from '@/components/AppButton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { buildExportName, toFileName } from '@/lib/files/filename';
import { LINK_STYLES } from '@shared/resume/resumeHeader';
import { cn } from '@/lib/utils';
import { showToast, useOverlayStore, type ExportVersion } from '@/stores/overlayStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useUIStore } from '@/stores/uiStore';
import type { LinkStyle } from '@shared/types/resume';
import type { PaperSize } from '@/types/ui';
import {
  copyText,
  EXPORT_FORMATS,
  renderExport,
  type ExportFormat,
  type ExportFormatInfo,
} from './exportResume';

const FORMAT_ICONS: Record<ExportFormat, LucideIcon> = {
  pdf: FileText,
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
    <Dialog open={open} onOpenChange={(next) => !next && closeExport()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-[min(40rem,96vw)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-zinc-200 bg-white p-0 sm:max-w-none dark:border-zinc-800 dark:bg-zinc-950"
      >
        {/* Mounted per opening, so the format and file name start fresh each time. */}
        {open && <ExportForm version={version} onDone={closeExport} />}
      </DialogContent>
    </Dialog>
  );
}

function ExportForm({ version, onDone }: { version: ExportVersion | null; onDone: () => void }) {
  const draftContactName = useResumeStore((s) => s.contact.name);
  const templateId = useResumeStore((s) => s.templateId);
  const activeTemplate = useActiveTemplate();
  const paperSize = useUIStore((s) => s.paperSize);
  const setPaperSize = useUIStore((s) => s.setPaperSize);

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

  const source = () => ({
    doc: version ? version.version.doc : getResumeSnapshot(),
    templateId: version ? null : templateId,
  });

  const save = async () => {
    setBusy('save');
    const fileName = toFileName(name, format.extension);
    try {
      const content = await renderExport(format.id, source(), paperSize);
      const saved = await window.mosaic.files.save(format.fileType, fileName, content);
      // Cancelled: stay, so a different name or format is one click away.
      if (saved === null) return;
      showToast(`Saved ${saved}`);
      onDone();
    } catch (error) {
      console.error(error);
      showToast(`Could not save ${fileName}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    setBusy('copy');
    try {
      const content = await renderExport(format.id, source(), paperSize);
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
            {version.label} of {version.templateName}, “{version.version.summary}” — as it was then,
            not your draft.
          </p>
        )}

        <RadioGroup
          value={formatId}
          onValueChange={(value) => setFormatId(value as ExportFormat)}
          aria-label="Format"
          className="grid gap-2 sm:grid-cols-2"
        >
          {formats.map((option) => (
            <FormatOption key={option.id} format={option} selected={option.id === formatId} />
          ))}
        </RadioGroup>

        <div className="mt-2">
          {format.id === 'pdf' && (
            <Row label="Paper">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={paperSize}
                onValueChange={(value) => value && setPaperSize(value as PaperSize)}
                aria-label="Paper"
              >
                <ToggleGroupItem value="a4">A4</ToggleGroupItem>
                <ToggleGroupItem value="letter">Letter</ToggleGroupItem>
              </ToggleGroup>
            </Row>
          )}
          <Row label="Header links" description={format.headerLinkNote}>
            {format.id === 'pdf' && <HeaderLinksControl version={version} />}
          </Row>
          <Row label="File name">
            <div className="flex w-[min(18rem,100%)]">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label="File name"
                className="h-8 rounded-r-none font-mono text-xs"
              />
              <span className="grid h-8 shrink-0 place-items-center rounded-r-md border border-l-0 border-zinc-200 bg-zinc-100 px-2 font-mono text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                .{format.extension}
              </span>
            </div>
          </Row>
        </div>
      </div>

      <DialogFrameFooter note="Exports never leave this machine.">
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
          : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
      )}
    >
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-md border',
          selected
            ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400'
            : 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800'
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {format.name}
          {format.id === 'pdf' && (
            <span className="rounded border border-zinc-200 px-1 text-[0.65rem] leading-4 font-medium text-zinc-500 dark:border-zinc-700">
              default
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-600 dark:text-zinc-400">
          {format.description}
        </span>
      </span>
      <RadioGroupItem id={id} value={format.id} className="mt-0.5" />
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
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 py-2.5 last:border-b-0 dark:border-zinc-800">
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
 * How the header's links look in the PDF. It is the resume's own setting, so the draft's
 * can be changed here; a version shows the one it was saved with.
 */
function HeaderLinksControl({ version }: { version: ExportVersion | null }) {
  const draftLinkStyle = useResumeStore((s) => s.contact.header.linkStyle);
  const setLinkStyle = useResumeStore((s) => s.setLinkStyle);
  if (version) {
    const { linkStyle } = version.version.doc.contact.header;
    return (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {LINK_STYLES.find((style) => style.value === linkStyle)?.label}
      </span>
    );
  }
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={draftLinkStyle}
      onValueChange={(value) => value && setLinkStyle(value as LinkStyle)}
      aria-label="Header links"
    >
      {LINK_STYLES.map(({ value, label }) => (
        <ToggleGroupItem key={value} value={value}>
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
