import { useState } from 'react';
import { AlertTriangle, FileText, Upload } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { getPrintableHeaderLines } from '@shared/resume/resumeHeader';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import type { ContactInfo } from '@shared/types/resume';
import { applyImportChoices, type PlaceTarget } from './applyImportChoices';
import {
  buildImportedResume,
  describeImport,
  keepsHeader,
  type ImportMode,
} from './buildImportedResume';
import { ImportModeButton } from './ImportModeButton';
import { LeftOutLines } from './LeftOutLines';
import type { ParsedResume } from './parsing/parseResume';
import { ReviewContactRow } from './ReviewContactRow';
import { ReviewSectionRow } from './ReviewSectionRow';
import { formatCount as count } from './formatCount';

export interface ReadResume {
  /** A file's name, or "pasted text". */
  source: string;
  parsed: ParsedResume;
}

const FILE_KINDS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word document',
  md: 'Markdown',
  markdown: 'Markdown',
  txt: 'Plain text',
  text: 'Plain text',
  json: 'JSON Resume',
};

const kindOf = (source: string) => FILE_KINDS[source.split('.').pop()?.toLowerCase() ?? ''];

/** "Links underlined and blue, as in the file.", when the file's links weren't plain black. */
function describeLinkLook({ header }: ContactInfo): string | null {
  const hasLinks = getPrintableHeaderLines(header).some((line) =>
    line.items.some((item) => item.href)
  );
  const looks = [
    header.linkStyle === 'underline' && 'underlined',
    header.linkColor === 'blue' && 'blue',
  ].filter(Boolean);
  return hasLinks && looks.length > 0 ? `Links ${looks.join(' and ')}, as in the file.` : null;
}

const hasDoubts = (parsed: ParsedResume, sectionId: string) => {
  const section = parsed.resume.sections.find(({ id }) => id === sectionId)!;
  const ids = section.items.flatMap((item) => [item.id, ...item.bullets.map(({ id }) => id)]);
  return [sectionId, ...ids].some(
    (id) => (parsed.review.sections[id] ?? parsed.review.items[id])?.doubts.length
  );
};

export function ImportReview({
  read,
  onBack,
  onDone,
}: {
  read: ReadResume;
  onBack: () => void;
  onDone: () => void;
}) {
  const asNewOnly = useOverlayStore((s) => s.importAsNewOnly);
  const closeSurface = useOverlayStore((s) => s.closeSurface);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const importIntoDraft = useTemplateStore((s) => s.importIntoDraft);
  const setActiveSidebarTab = useUiStore((s) => s.setActiveSidebarTab);
  const openContact = useResumeStore((s) => s.contact);
  const { parsed, source } = read;
  const { contact, sections } = parsed.resume;

  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  const [placed, setPlaced] = useState<ReadonlyMap<number, PlaceTarget>>(new Map());
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(
    () => new Set(sections.filter(({ id }) => hasDoubts(parsed, id)).map(({ id }) => id))
  );
  const [chosenMode, setMode] = useState<ImportMode>('new');
  const [isImporting, setImporting] = useState(false);
  const mode = asNewOnly ? 'new' : chosenMode;

  const result = applyImportChoices(parsed, { dropped, placed });
  const summary = describeImport(result);
  const kind = kindOf(source);

  const toggle = (id: string) => {
    const isDropping = !dropped.has(id);
    setDropped((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
    // Lines sent to a section that is now left out go back to Left out.
    if (isDropping && sections.some((section) => section.id === id)) {
      setPlaced(
        (previous) =>
          new Map([...previous].filter(([, target]) => target === 'new' || target.sectionId !== id))
      );
    }
  };
  const keepAll = (ids: string[]) =>
    setDropped((previous) => new Set([...previous].filter((id) => !ids.includes(id))));
  const setOpen = (id: string, isOpen: boolean) =>
    setOpenSections((previous) => {
      const next = new Set(previous);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  const place = (index: number, target: PlaceTarget) =>
    setPlaced((previous) => new Map(previous).set(index, target));
  const unplace = (index: number) =>
    setPlaced((previous) => {
      const next = new Map(previous);
      next.delete(index);
      return next;
    });

  const importResume = async () => {
    if (result.resume.sections.length === 0 || isImporting) return;
    const doc = buildImportedResume(getResumeSnapshot(), result, mode);
    setImporting(true);
    const imported = await attempt(
      mode === 'new'
        ? createTemplate(contact.name.trim().slice(0, 80) || 'Imported resume', doc, source)
        : importIntoDraft(doc, source),
      'Could not import the resume'
    );
    setImporting(false);
    if (!imported) return;
    onDone();
    closeSurface('start');
    setActiveSidebarTab('content');
    showToast('Imported. Check the sections in the sidebar.');
  };

  const footerCounts = [
    count(summary.sectionCount, 'section'),
    summary.entryCount > 0 && count(summary.entryCount, 'entry', 'entries'),
    summary.bulletCount > 0 && count(summary.bulletCount, 'bullet'),
    count(summary.lineCount, 'line'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div data-import-step="review" className="contents">
      <DialogFrameHeader
        icon={Upload}
        title="Import"
        description="Review what Mosaic found before importing it."
        closeLabel="Close import"
        onClose={onDone}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        <div className="mb-2.25 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2">
            <FileText className="size-3.5 shrink-0 text-ink-muted" />
            <span className="truncate font-mono text-[0.71875rem] text-foreground">{source}</span>
            {kind && <span className="shrink-0 text-xs text-ink-muted">{kind}</span>}
          </p>
          <AppButton variant="ghost" size="xs" onClick={onBack}>
            Choose another
          </AppButton>
        </div>

        {parsed.warnings.map((warning) => (
          <p
            key={warning}
            className="mb-2.25 flex gap-2.5 rounded-[0.5625rem] border border-amber-300 bg-amber-50 px-3 py-2.75 text-[0.8rem] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            {warning}
          </p>
        ))}

        <ul className="divide-y divide-line overflow-hidden rounded-[0.5625rem] border border-line">
          <ReviewContactRow
            contact={contact}
            linkNote={describeLinkLook(contact)}
            isHeaderKept={mode === 'merge' && keepsHeader(openContact)}
          />
          {sections.map((section) => (
            <ReviewSectionRow
              key={section.id}
              section={section}
              review={parsed.review}
              dropped={dropped}
              placedCount={
                [...placed.values()].filter(
                  (target) => target !== 'new' && target.sectionId === section.id
                ).length
              }
              isOpen={openSections.has(section.id)}
              onOpenChange={(isOpen) => setOpen(section.id, isOpen)}
              onToggle={toggle}
              onKeepAll={keepAll}
            />
          ))}
        </ul>

        {parsed.leftOut.length > 0 && (
          <LeftOutLines
            lines={parsed.leftOut}
            placed={placed}
            sections={sections
              .filter(({ id }) => !dropped.has(id))
              .map(({ id, label, layout }) => ({ id, label, layout }))}
            onPlace={place}
            onUnplace={unplace}
          />
        )}
      </div>

      <DialogFrameFooter note={sections.length > 0 ? footerCounts : undefined}>
        <AppButton variant="outline" size="sm" onClick={onDone}>
          Cancel
        </AppButton>
        <ImportModeButton
          mode={mode}
          onModeChange={setMode}
          canChoose={!asNewOnly}
          disabled={result.resume.sections.length === 0 || isImporting}
          onImport={() => void importResume()}
        />
      </DialogFrameFooter>
    </div>
  );
}
