import { useState, type DragEvent } from 'react';
import { AlertTriangle, Info, Upload } from 'lucide-react';
import { DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { AppButton } from '@/components/AppButton';
import { AppDialog, AppDialogContent } from '@/components/AppDialog';
import { AppTextarea } from '@/components/AppTextarea';
import { Note } from '@/components/Note';
import { Text } from '@/components/Text';
import { fileFailure } from '@/features/backup/backupFiles';
import { easeHeightChanges } from '@/lib/motion/easeHeightChanges';
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
    <AppDialog open={open} onOpenChange={(next) => !next && closeImport()}>
      <AppDialogContent
        ref={easeHeightChanges}
        showCloseButton={false}
        className="flex max-h-[90vh] w-[min(38.75rem,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0 transition-[width] duration-160 sm:max-w-none motion-reduce:transition-none has-data-[import-step=review]:w-[min(50rem,96vw)]"
      >
        {/* Mounted per opening, so each import starts from the file picker. */}
        {open && <ImportFlow onDone={closeImport} />}
      </AppDialogContent>
    </AppDialog>
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
            dragging ? 'border-amber bg-amber-soft' : 'border-line-heavy bg-pane'
          )}
        >
          <span className="mb-2.25 grid size-8.5 place-items-center rounded-full border border-line-strong bg-pane-raised text-ink-muted">
            <Upload className="size-4.5" />
          </span>
          <Text as="p" variant="title" className="mb-0.75">
            Drop a resume here
          </Text>
          <Text as="p" variant="secondary" className="mx-auto mb-3 max-w-82">
            PDF, Word (.docx), Markdown, plain text, JSON Resume, or a Mosaic JSON backup.
          </Text>
          <AppButton variant="outline" size="sm" onClick={() => void choose()}>
            Choose a file…
          </AppButton>
        </div>

        {fileError && (
          <Note icon={AlertTriangle} tone="error" size="sm" role="alert" className="mt-2.5">
            {fileError}
          </Note>
        )}

        <label
          htmlFor="import-paste"
          className="mt-3.5 mb-1.25 block text-support font-control text-ink-soft"
        >
          Or paste the text
        </label>
        <AppTextarea
          id="import-paste"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className="h-30 px-2.5 py-2 font-mono text-meta"
        />

        <Note icon={Info} className="mt-3">
          Everything is read on your computer. Import is a quick start, not an exact copy, and a
          PDF’s layout is the hardest to read back. You’ll see what Mosaic found and what it left
          out, and choose what to keep, before anything is written.
        </Note>
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
