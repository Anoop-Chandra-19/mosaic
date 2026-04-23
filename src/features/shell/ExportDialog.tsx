import { useState } from 'react';
import { Check, File, FileCode2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { PaperSize } from '@/types/ui';
import { cn } from '@/lib/utils';

type ExportFormat = 'pdf' | 'markdown' | 'plaintext';
type FormatOptionId = ExportFormat | 'docx';

interface ExportSummary {
  contactName: string;
  templateName: string;
  selectedBulletCount: number;
  paperSize: PaperSize;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPdfFileName: string;
  exportSummary: ExportSummary;
  isPdfBusy: boolean;
  isSavingPdf: boolean;
  handleExportPdf: (fileName?: string) => Promise<void>;
  handleCopyMarkdown: () => Promise<void>;
  handleCopyPlaintext: () => Promise<void>;
}

interface FormatOption {
  id: FormatOptionId;
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof FileText;
  disabled?: boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'pdf',
    label: 'PDF',
    eyebrow: 'PDF',
    description: 'Print-ready export for applications',
    icon: FileText,
  },
  {
    id: 'docx',
    label: 'Word',
    eyebrow: 'DOCX',
    description: 'Editable in Word, Pages, Google Docs',
    icon: File,
    disabled: true,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    eyebrow: 'MD',
    description: 'Plain text for GitHub READMEs and portfolios',
    icon: FileCode2,
  },
  {
    id: 'plaintext',
    label: 'Plain text',
    eyebrow: 'TXT',
    description: 'Copy-paste friendly for ATS fields',
    icon: FileText,
  },
];

export function ExportDialog({
  open,
  onOpenChange,
  defaultPdfFileName,
  exportSummary,
  isPdfBusy,
  isSavingPdf,
  handleExportPdf,
  handleCopyMarkdown,
  handleCopyPlaintext,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [fileName, setFileName] = useState(defaultPdfFileName);

  const handlePrimaryAction = async () => {
    if (selectedFormat === 'pdf') {
      await handleExportPdf(fileName);
    }
    if (selectedFormat === 'markdown') {
      await handleCopyMarkdown();
    }
    if (selectedFormat === 'plaintext') {
      await handleCopyPlaintext();
    }
    onOpenChange(false);
  };

  const primaryLabel =
    selectedFormat === 'pdf'
      ? isSavingPdf
        ? 'Saving...'
        : 'Save PDF'
      : selectedFormat === 'markdown'
        ? 'Copy Markdown'
        : 'Copy Plain Text';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl sm:max-w-md">
        <div className="p-5">
          <DialogHeader className="gap-1 pr-6">
            <DialogTitle className="text-base text-zinc-100">Export resume</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              {exportSummary.contactName} - {exportSummary.templateName} /{' '}
              {exportSummary.paperSize.toUpperCase()} / {exportSummary.selectedBulletCount} selected
              bullets
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-2">
            {FORMAT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = option.id === selectedFormat;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    if (!option.disabled && option.id !== 'docx') {
                      setSelectedFormat(option.id);
                    }
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-amber-600 bg-amber-950 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900',
                    option.disabled && 'cursor-not-allowed text-zinc-600'
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-300">
                    {option.eyebrow}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="size-3.5" />
                      {option.label}
                      {option.disabled && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[0.65rem] font-medium text-zinc-500">
                          later
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{option.description}</span>
                  </span>
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded border',
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-zinc-950'
                        : 'border-zinc-600 text-zinc-600'
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-sm font-semibold text-zinc-200">Filename</p>
              <p className="text-xs text-zinc-500">Template from current editor state</p>
            </div>
            <Input
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              disabled={selectedFormat !== 'pdf'}
              className="h-8 border-zinc-800 bg-zinc-900 text-xs text-zinc-200 disabled:text-zinc-600"
              aria-label="Export filename"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-zinc-800 bg-zinc-900 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrimaryAction} disabled={isPdfBusy && selectedFormat === 'pdf'}>
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
