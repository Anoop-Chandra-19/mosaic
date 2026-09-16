import { useMemo, useState, type DragEvent } from 'react';
import { AlertTriangle, FileText, Info, Upload } from 'lucide-react';
import { DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fileFailure } from '@/features/backup/backupFiles';
import { cn } from '@/lib/utils';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { MAX_FILE_BYTES } from '@/types/files';
import type { ContactInfo, ResumeSection, SectionLayout } from '@/types/resume';
import { buildImportedResume, type ImportMode } from './buildImportedResume';
import { LeftOutLines } from './LeftOutLines';
import { parseResumeText, type ParsedResume } from './parseResume';
import { readImportFile, UnreadableFileError, type ImportRead } from './readImportFile';

/** Recorded in the template's history as where pasted content came from. */
const PASTED = 'pasted text';

const MODE_OPTIONS: { id: ImportMode; label: string; hint: string }[] = [
  {
    id: 'new',
    label: 'New template',
    hint: 'Opens as its own template. The one you have open stays as it is.',
  },
  {
    id: 'replace',
    label: 'Replace',
    hint: 'Replaces what’s in the editor. The current draft is kept in history first, so you can restore it.',
  },
  {
    id: 'merge',
    label: 'Add to current',
    hint: 'Adds these sections to the open resume. The current draft is kept in history first.',
  },
];

const IMPORT_LABELS: Record<ImportMode, string> = {
  new: 'Import as new template',
  replace: 'Replace resume',
  merge: 'Add to resume',
};

const CONTACT_FIELDS: [keyof ContactInfo, string][] = [
  ['name', 'name'],
  ['email', 'email'],
  ['phone', 'phone'],
  ['location', 'location'],
  ['linkedin', 'LinkedIn'],
  ['github', 'GitHub'],
  ['website', 'website'],
];

const PLACEHOLDER = `Jane Developer
San Francisco, CA · jane@example.com · (555) 987-6543

Experience
Senior Engineer
Acme Corp — 2021 to Present
- Led the migration to a microservices architecture`;

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a section holds: "3 entries, 11 bullets", or "2 lines" for a list. */
function describeSection({ layout, items }: ResumeSection): string {
  if (layout === 'lines') return count(items.length, 'line');
  const bullets = items.reduce((n, item) => n + item.bullets.length, 0);
  const entries = count(items.length, 'entry', 'entries');
  return bullets > 0 ? `${entries}, ${count(bullets, 'bullet')}` : entries;
}

/** What Add Section calls a section the user names, in each shape. */
const CUSTOM_NAMES: Record<SectionLayout, string> = {
  entries: 'custom section',
  lines: 'custom list',
};

interface ReadResume {
  /** A file's name, or "pasted text". */
  source: string;
  parsed: ParsedResume;
}

/**
 * Bring a resume in: a Markdown, text, or JSON Resume file, pasted text, or a Mosaic backup
 * (handed on to Restore). What Mosaic found is shown for review before anything is written.
 */
export function ImportResumeDialog() {
  const open = useOverlayStore((s) => s.importOpen);
  const closeImport = useOverlayStore((s) => s.closeImport);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeImport()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-[min(38rem,96vw)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-zinc-200 bg-white p-0 sm:max-w-none dark:border-zinc-800 dark:bg-zinc-950"
      >
        {/* Mounted per opening, so each import starts from the file picker. */}
        {open && <ImportFlow onDone={closeImport} />}
      </DialogContent>
    </Dialog>
  );
}

/** Why a file couldn't be read, in words for the user. */
function unreadable(error: unknown, fallback: string): string {
  return error instanceof UnreadableFileError ? error.message : fileFailure(error, fallback);
}

function ImportFlow({ onDone }: { onDone: () => void }) {
  const [read, setRead] = useState<ReadResume | null>(null);
  // A file that couldn't be read: said under the drop zone until the next try.
  const [fileError, setFileError] = useState<string | null>(null);
  const setPendingRestore = useOverlayStore((s) => s.setPendingRestore);

  /** A file from the picker or a drop: a resume to review, or a backup to restore. */
  const readFile = async (name: string, bytes: Uint8Array) => {
    let result: ImportRead;
    try {
      result = await readImportFile(name, bytes);
    } catch (error) {
      setFileError(unreadable(error, `Mosaic couldn’t read ${name}.`));
      return;
    }
    setFileError(null);
    if (result.type === 'backup') {
      onDone();
      setPendingRestore(result.backup);
      return;
    }
    setRead({ source: result.source, parsed: result.parsed });
  };

  return read ? (
    <ReviewStep read={read} onBack={() => setRead(null)} onDone={onDone} />
  ) : (
    <PickStep
      fileError={fileError}
      onFileError={setFileError}
      onFile={readFile}
      onPaste={(text) => setRead({ source: PASTED, parsed: parseResumeText(text) })}
      onCancel={onDone}
    />
  );
}

function PickStep({
  fileError,
  onFileError,
  onFile,
  onPaste,
  onCancel,
}: {
  fileError: string | null;
  onFileError: (message: string) => void;
  onFile: (name: string, bytes: Uint8Array) => Promise<void>;
  onPaste: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);

  const choose = async () => {
    try {
      const file = await window.mosaic.files.open('import');
      if (file) await onFile(file.name, file.bytes);
    } catch (error) {
      onFileError(unreadable(error, 'Mosaic couldn’t open that file.'));
    }
  };

  const drop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      onFileError(`${file.name} is larger than 128 MB.`);
      return;
    }
    await onFile(file.name, new Uint8Array(await file.arrayBuffer()));
  };

  return (
    <>
      <DialogFrameHeader
        icon={Upload}
        title="Import"
        description="Import a resume from a file or pasted text, or restore a Mosaic backup."
        closeLabel="Close import"
        onClose={onCancel}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => void drop(event)}
          className={cn(
            'flex flex-col items-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
            dragging
              ? 'border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950'
              : 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900'
          )}
        >
          <span className="mb-2.5 grid size-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            <Upload className="size-4" />
          </span>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Drop a resume here
          </p>
          <p className="mt-1 mb-3 text-xs text-zinc-600 dark:text-zinc-400">
            Word (.docx), Markdown, plain text, JSON Resume, or a Mosaic JSON backup.
          </p>
          <Button variant="outline" size="sm" onClick={() => void choose()}>
            Choose a file…
          </Button>
        </div>

        {fileError && (
          <p
            role="alert"
            className="mt-2.5 flex gap-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs leading-relaxed text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
            {fileError}
          </p>
        )}

        <label
          htmlFor="import-paste"
          className="mt-4 mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Or paste the text
        </label>
        <Textarea
          id="import-paste"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className="h-36 resize-none font-mono text-xs leading-5"
        />

        <p className="mt-3 flex gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <Info className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
          Everything is read on this machine. Import is a quick start, not an exact copy: you’ll see
          what Mosaic found and what it left out, and choose what to keep, before anything is
          written.
        </p>
      </div>

      <DialogFrameFooter>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={text.trim() === ''} onClick={() => onPaste(text)}>
          Read pasted text
        </Button>
      </DialogFrameFooter>
    </>
  );
}

function ReviewStep({
  read,
  onBack,
  onDone,
}: {
  read: ReadResume;
  onBack: () => void;
  onDone: () => void;
}) {
  const asNewOnly = useOverlayStore((s) => s.importAsNewOnly);
  const setStartOpen = useOverlayStore((s) => s.setStartOpen);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const importIntoDraft = useTemplateStore((s) => s.importIntoDraft);
  const setActiveSidebarTab = useUIStore((s) => s.setActiveSidebarTab);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [chosenMode, setMode] = useState<ImportMode>('new');
  const [importing, setImporting] = useState(false);
  const mode = asNewOnly ? 'new' : chosenMode;
  const { parsed, source } = read;
  const { contact, sections } = parsed.resume;

  const included = useMemo(
    () => sections.filter((section) => !excludedIds.has(section.id)),
    [sections, excludedIds]
  );
  const found = CONTACT_FIELDS.filter(([key]) => contact[key]).map(([, label]) => label);

  const toggle = (id: string) =>
    setExcludedIds((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const importResume = async () => {
    if (included.length === 0 || importing) return;
    const filtered: ParsedResume = { ...parsed, resume: { ...parsed.resume, sections: included } };
    const doc = buildImportedResume(getResumeSnapshot(), filtered, mode);
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
    setStartOpen(false);
    setActiveSidebarTab('content');
    showToast('Imported — check the sections in the sidebar');
  };

  return (
    <>
      <DialogFrameHeader
        icon={Upload}
        title="Import"
        description="Review what Mosaic found before importing it."
        closeLabel="Close import"
        onClose={onDone}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-xs">
            <FileText className="size-3.5 shrink-0 text-zinc-500" />
            <span className="truncate font-mono text-zinc-900 dark:text-zinc-100">{source}</span>
            <span className="shrink-0 rounded border border-emerald-300 bg-emerald-50 px-1.5 text-[0.65rem] leading-4 font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              read
            </span>
          </p>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onBack}>
            Choose another
          </Button>
        </div>

        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
          <li className="flex items-center gap-2.5 px-3 py-2">
            <span className="size-4 shrink-0" />
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Contact</span>
            <span
              className={cn(
                'text-xs',
                found.length
                  ? 'text-zinc-600 dark:text-zinc-400'
                  : 'text-amber-700 dark:text-amber-400'
              )}
            >
              — {found.length ? `${found.join(', ')} found` : 'nothing found'}
            </span>
          </li>
          {sections.map((section) => {
            const on = !excludedIds.has(section.id);
            // A heading Mosaic has no preset for: it comes in under its own name.
            const custom = section.kind === 'custom';
            return (
              <li key={section.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2">
                  <Checkbox
                    checked={on}
                    onCheckedChange={() => toggle(section.id)}
                    aria-label={`Import ${section.label}`}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'font-medium',
                        on ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'
                      )}
                    >
                      {section.label}
                    </span>{' '}
                    <span
                      className={cn(
                        'text-xs',
                        custom
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      — {describeSection(section)}
                      {custom && `, imported as a ${CUSTOM_NAMES[section.layout]}`}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {parsed.leftOut.length > 0 && <LeftOutLines lines={parsed.leftOut} />}

        {parsed.warnings.length > 0 && (
          <div className="mt-3 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950">
            {parsed.warnings.map((warning) => (
              <p
                key={warning}
                className="flex gap-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                {warning}
              </p>
            ))}
          </div>
        )}

        {!asNewOnly && sections.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                How to import
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={mode}
                onValueChange={(value) => value && setMode(value as ImportMode)}
                aria-label="How to import"
              >
                {MODE_OPTIONS.map((option) => (
                  <ToggleGroupItem key={option.id} value={option.id}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {MODE_OPTIONS.find((option) => option.id === mode)?.hint}
            </p>
          </div>
        )}
      </div>

      <DialogFrameFooter>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={included.length === 0 || importing}
          onClick={() => void importResume()}
        >
          {IMPORT_LABELS[mode]}
        </Button>
      </DialogFrameFooter>
    </>
  );
}
