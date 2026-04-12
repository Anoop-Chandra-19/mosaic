import { useEffect, useRef, useState } from 'react';
import { Moon, Sun, Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useResumeStore } from '@/stores/resumeStore';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useIsMobile';
import { useUIStore } from '@/stores/uiStore';
import { normalizeResumeForExport } from '@/lib/export/normalizeResumeExport';
import { createMarkdownExport } from '@/lib/export/markdown';
import { createPlaintextExport } from '@/lib/export/plaintext';
import { buildPdfFileName } from '@/lib/export/filename';
import { downloadResumePdf, openResumePdfPreview } from '@/lib/export/pdf';
import { SettingsDialog } from '@/components/settings/SettingsDialog';

type ExportFeedback = {
  tone: 'success' | 'error';
  message: string;
};

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  }
}

export function TopBar() {
  const darkMode = useUIStore((state) => state.darkMode);
  const mobilePane = useUIStore((state) => state.mobilePane);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);
  const setMobilePane = useUIStore((state) => state.setMobilePane);
  const paperSize = useUIStore((state) => state.paperSize);
  const contact = useResumeStore((state) => state.contact);
  const sections = useResumeStore((state) => state.sections);
  const isMobile = useIsMobile();
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [feedback, setFeedback] = useState<ExportFeedback | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const isPdfBusy = isSavingPdf || isPreviewingPdf;

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const showFeedback = (nextFeedback: ExportFeedback) => {
    setFeedback(nextFeedback);
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
    }, 2200);
  };

  const handleCopyMarkdown = async () => {
    const normalized = normalizeResumeForExport({ contact, sections });
    const markdown = createMarkdownExport(normalized);
    const copied = await copyTextToClipboard(markdown);

    if (copied) {
      showFeedback({ tone: 'success', message: 'Markdown copied' });
      return;
    }

    showFeedback({ tone: 'error', message: 'Could not copy markdown' });
  };

  const handleCopyPlaintext = async () => {
    const normalized = normalizeResumeForExport({ contact, sections });
    const plaintext = createPlaintextExport(normalized);
    const copied = await copyTextToClipboard(plaintext);

    if (copied) {
      showFeedback({ tone: 'success', message: 'Plaintext copied' });
      return;
    }

    showFeedback({ tone: 'error', message: 'Could not copy plaintext' });
  };

  const handleExportPdf = async () => {
    if (isPdfBusy) {
      return;
    }

    setIsSavingPdf(true);

    try {
      const normalized = normalizeResumeForExport({ contact, sections });
      const fileName = buildPdfFileName({
        contactName: normalized.contact.name,
        paperSize,
      });
      await downloadResumePdf({
        data: normalized,
        paperSize,
        fileName,
      });
      showFeedback({ tone: 'success', message: `Saved PDF: ${fileName}` });
    } catch {
      showFeedback({ tone: 'error', message: 'Could not export PDF' });
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (isPdfBusy) {
      return;
    }

    setIsPreviewingPdf(true);

    try {
      const normalized = normalizeResumeForExport({ contact, sections });
      const fileName = buildPdfFileName({
        contactName: normalized.contact.name,
        paperSize,
      });
      const result = await openResumePdfPreview({
        data: normalized,
        paperSize,
        fileName,
      });
      showFeedback({
        tone: 'success',
        message: result.openedPreview
          ? 'Preview opened in a new tab'
          : `Popup blocked, downloaded: ${fileName}`,
      });
    } catch {
      showFeedback({ tone: 'error', message: 'Could not preview PDF' });
    } finally {
      setIsPreviewingPdf(false);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 font-bold text-white">
            M
          </div>
          <span className="text-lg font-semibold">Mosaic</span>
        </div>

        <div className="flex items-center gap-1">
          {feedback && (
            <span
              className={cn(
                'hidden pr-1 text-xs font-medium md:inline',
                feedback.tone === 'success' ? 'text-zinc-600 dark:text-zinc-300' : 'text-red-700'
              )}
            >
              {feedback.message}
            </span>
          )}

          {isMobile && (
            <div className="mr-1 flex items-center rounded-md border border-border p-0.5">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setMobilePane('editor')}
                className={cn(
                  'h-7 px-2 text-xs',
                  mobilePane === 'editor' && 'bg-muted text-foreground'
                )}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setMobilePane('preview')}
                className={cn(
                  'h-7 px-2 text-xs',
                  mobilePane === 'preview' && 'bg-muted text-foreground'
                )}
              >
                Preview
              </Button>
            </div>
          )}

          <Button variant="ghost" size="icon" onClick={toggleDarkMode} aria-label="Toggle theme">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Export resume">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={isPdfBusy} onSelect={handleExportPdf}>
                {isSavingPdf ? 'Saving PDF...' : 'Export as PDF'}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isPdfBusy} onSelect={handlePreviewPdf}>
                {isPreviewingPdf ? 'Opening preview...' : 'Preview PDF'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleCopyMarkdown}>Copy as Markdown</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleCopyPlaintext}>Copy as Plaintext</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
