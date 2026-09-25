import { useState, type DragEvent } from 'react';
import { AlertTriangle, Info, Upload } from 'lucide-react';
import { DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { AppButton } from '@/components/AppButton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { fileFailure } from '@/features/backup/backupFiles';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';
import { MAX_FILE_BYTES } from '@shared/types/files';
import { ImportReview, type ReadResume } from './ImportReview';
import { parseResumeText } from './parsing/parseResume';
import { readImportFile, UnreadableFileError, type ImportRead } from './readers/readImportFile';

/** Recorded in the template's history as where pasted content came from. */
const PASTED = 'pasted text';

const PLACEHOLDER = `Jane Developer
San Francisco, CA · jane@example.com · (555) 987-6543

Experience
Senior Engineer
Acme Corp - 2021 to Present
- Led the migration to a microservices architecture`;

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
        className="flex max-h-[90vh] w-[min(38.75rem,96vw)] max-w-none flex-col gap-0 overflow-hidden rounded-xl bg-white p-0 transition-[width] duration-160 sm:max-w-none motion-reduce:transition-none has-[[data-import-step=review]]:w-[min(50rem,96vw)] dark:bg-zinc-950"
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
    <ImportReview read={read} onBack={() => setRead(null)} onDone={onDone} />
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
            'flex flex-col items-center rounded-[0.8125rem] border border-dashed px-4.5 py-5.5 text-center transition-colors',
            dragging
              ? 'border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950'
              : 'border-line-heavy bg-pane'
          )}
        >
          <span className="mb-2.25 grid size-8.5 place-items-center rounded-full border border-line-strong bg-pane-raised text-ink-muted">
            <Upload className="size-4.5" />
          </span>
          <p className="mb-0.75 text-[0.84375rem] font-semibold text-foreground">
            Drop a resume here
          </p>
          <p className="mx-auto mb-3 max-w-82 text-[0.78125rem] leading-normal text-ink-muted">
            PDF, Word (.docx), Markdown, plain text, JSON Resume, or a Mosaic JSON backup.
          </p>
          <AppButton variant="outline" size="sm" onClick={() => void choose()}>
            Choose a file…
          </AppButton>
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
          className="mt-3.5 mb-1.25 block text-xs font-medium text-ink-soft"
        >
          Or paste the text
        </label>
        <Textarea
          id="import-paste"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          // An example, not content: quieter than the theme's placeholder, which at seven
          // lines reads as something already pasted.
          className="h-30 resize-none px-2.5 py-2 font-mono text-[0.71875rem] leading-[1.65] placeholder:text-ink-faint"
        />

        <p className="mt-3 flex gap-2.5 rounded-[0.5625rem] border border-line-strong bg-pane px-3 py-2.75 text-[0.8rem] leading-relaxed text-ink-soft">
          <Info className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
          Everything is read on this machine. Import is a quick start, not an exact copy, and a
          PDF’s layout is the hardest to read back. You’ll see what Mosaic found and what it left
          out, and choose what to keep, before anything is written.
        </p>
      </div>

      <DialogFrameFooter note="Nothing is written until you review it.">
        <AppButton variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </AppButton>
        <AppButton size="sm" disabled={text.trim() === ''} onClick={() => onPaste(text)}>
          Read pasted text
        </AppButton>
      </DialogFrameFooter>
    </>
  );
}
