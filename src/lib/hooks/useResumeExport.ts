import { useState } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import { useUIStore } from '@/stores/uiStore';
import { useTemplateStore } from '@/stores/templateStore';
import { normalizeResumeForExport } from '@/lib/export/normalizeResumeExport';
import { createMarkdownExport } from '@/lib/export/markdown';
import { createPlaintextExport } from '@/lib/export/plaintext';
import { buildPdfFileName } from '@/lib/export/filename';
import { downloadResumePdf, openResumePdfPreview } from '@/lib/export/pdf';
import { useTemporaryState } from '@/lib/hooks/useTemporaryState';

export type ExportFeedback = {
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

export function useResumeExport() {
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const paperSize = useUIStore((s) => s.paperSize);
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId);
  const templates = useTemplateStore((s) => s.templates);
  const [feedback, setFeedback] = useTemporaryState<ExportFeedback | null>(null, 2200);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false);
  const isPdfBusy = isSavingPdf || isPreviewingPdf;
  const activeTemplateName = templates.find((template) => template.id === activeTemplateId)?.name;
  const defaultPdfFileName = buildPdfFileName({
    contactName: contact.name,
    templateName: activeTemplateName,
    paperSize,
  });
  const selectedBulletCount = sections.reduce(
    (total, section) =>
      total +
      section.items
        .filter((entry) => entry.selected)
        .reduce(
          (entryTotal, entry) =>
            entryTotal + entry.bullets.filter((bullet) => bullet.selected).length,
          0
        ),
    0
  );

  const handleCopyMarkdown = async () => {
    const normalized = normalizeResumeForExport({ schemaVersion, contact, sections });
    const markdown = createMarkdownExport(normalized);
    const copied = await copyTextToClipboard(markdown);
    setFeedback(
      copied
        ? { tone: 'success', message: 'Markdown copied' }
        : { tone: 'error', message: 'Could not copy markdown' }
    );
  };

  const handleCopyPlaintext = async () => {
    const normalized = normalizeResumeForExport({ schemaVersion, contact, sections });
    const plaintext = createPlaintextExport(normalized);
    const copied = await copyTextToClipboard(plaintext);
    setFeedback(
      copied
        ? { tone: 'success', message: 'Plaintext copied' }
        : { tone: 'error', message: 'Could not copy plaintext' }
    );
  };

  const handleExportPdf = async (fileNameOverride?: string) => {
    if (isPdfBusy) return;
    setIsSavingPdf(true);
    try {
      const normalized = normalizeResumeForExport({ schemaVersion, contact, sections });
      const fileName = fileNameOverride?.trim() || defaultPdfFileName;
      await downloadResumePdf({ data: normalized, paperSize, fileName });
      setFeedback({ tone: 'success', message: `Saved PDF: ${fileName}` });
    } catch {
      setFeedback({ tone: 'error', message: 'Could not export PDF' });
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (isPdfBusy) return;
    setIsPreviewingPdf(true);
    try {
      const normalized = normalizeResumeForExport({ schemaVersion, contact, sections });
      const fileName = defaultPdfFileName;
      const result = await openResumePdfPreview({ data: normalized, paperSize, fileName });
      setFeedback({
        tone: 'success',
        message: result.openedPreview
          ? 'Preview opened in a new tab'
          : `Popup blocked, downloaded: ${fileName}`,
      });
    } catch {
      setFeedback({ tone: 'error', message: 'Could not preview PDF' });
    } finally {
      setIsPreviewingPdf(false);
    }
  };

  return {
    feedback,
    defaultPdfFileName,
    exportSummary: {
      contactName: contact.name.trim() || 'Untitled resume',
      templateName: activeTemplateName?.trim() || 'No template',
      selectedBulletCount,
      paperSize,
    },
    isPdfBusy,
    isSavingPdf,
    isPreviewingPdf,
    handleCopyMarkdown,
    handleCopyPlaintext,
    handleExportPdf,
    handlePreviewPdf,
  };
}
