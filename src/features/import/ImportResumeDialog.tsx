import { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, FileInput, Layers, Replace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { parseResumeText, type ParsedResume } from '@/lib/import/parseResumeText';
import {
  applyImportedResume,
  describeImport,
  type ImportMode,
} from '@/lib/import/applyImportedResume';

interface ImportResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODE_OPTIONS: { id: ImportMode; label: string; icon: typeof Replace; hint: string }[] = [
  {
    id: 'replace',
    label: 'Replace',
    icon: Replace,
    hint: 'Swap your current resume for the imported content.',
  },
  {
    id: 'merge',
    label: 'Add to current',
    icon: Layers,
    hint: 'Keep what you have and append the imported sections.',
  },
];

const PLACEHOLDER = `Jane Developer
San Francisco, CA · jane@example.com · (555) 987-6543

Experience
Senior Engineer
Acme Corp — 2021 to Present
- Led the migration to a microservices architecture

Education
B.S. Computer Science, State University

Skills
Languages: TypeScript, Python, Go`;

export function ImportResumeDialog({ open, onOpenChange }: ImportResumeDialogProps) {
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ImportMode>('replace');

  const reset = () => {
    setStep('paste');
    setText('');
    setParsed(null);
    setExcludedIds(new Set());
    setMode('replace');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleParse = () => {
    const result = parseResumeText(text);
    setParsed(result);
    setExcludedIds(new Set());
    setStep('review');
  };

  const includedSections = useMemo(
    () => parsed?.resume.sections.filter((section) => !excludedIds.has(section.id)) ?? [],
    [parsed, excludedIds]
  );

  const filteredParsed: ParsedResume | null = parsed
    ? { resume: { ...parsed.resume, sections: includedSections }, warnings: parsed.warnings }
    : null;

  const summary = filteredParsed ? describeImport(filteredParsed) : null;

  const toggleSection = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = () => {
    if (!filteredParsed || includedSections.length === 0) return;
    applyImportedResume(filteredParsed, mode);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl sm:max-w-lg">
        {step === 'paste' ? (
          <>
            <div className="p-5">
              <DialogHeader className="gap-1 pr-6">
                <DialogTitle className="flex items-center gap-2 text-base text-zinc-100">
                  <FileInput className="size-4 text-amber-500" />
                  Import resume
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  Paste an existing resume as text. Mosaic maps it into sections you can review
                  before anything changes.
                </DialogDescription>
              </DialogHeader>

              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                className="mt-4 h-64 resize-none border-zinc-800 bg-zinc-900 font-mono text-xs leading-5 text-zinc-200 placeholder:text-zinc-600"
                aria-label="Resume text"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Tip: keep section headings like Experience, Education, and Skills on their own
                lines.
              </p>
            </div>

            <DialogFooter className="border-t border-zinc-800 bg-zinc-900 px-5 py-3">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleParse} disabled={text.trim().length === 0}>
                Parse resume
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="p-5">
              <DialogHeader className="gap-1 pr-6">
                <DialogTitle className="flex items-center gap-2 text-base text-zinc-100">
                  <ClipboardList className="size-4 text-amber-500" />
                  Review import
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  {summary && summary.sectionCount > 0
                    ? `${summary.contactName || 'No name found'} · ${summary.sectionCount} sections · ${summary.entryCount} entries · ${summary.bulletCount} bullets`
                    : 'Nothing recognizable was found in that text.'}
                </DialogDescription>
              </DialogHeader>

              {parsed && parsed.warnings.length > 0 && (
                <div className="mt-4 space-y-1 rounded-lg border border-amber-900 bg-amber-950 p-3">
                  {parsed.warnings.map((warning) => (
                    <p key={warning} className="flex items-start gap-2 text-xs text-amber-300">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {warning}
                    </p>
                  ))}
                </div>
              )}

              {parsed && parsed.resume.sections.length > 0 && (
                <>
                  <p className="mt-4 mb-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                    Sections to import
                  </p>
                  <ul className="space-y-1.5">
                    {parsed.resume.sections.map((section) => {
                      const included = !excludedIds.has(section.id);
                      const bulletCount = section.items.reduce((n, i) => n + i.bullets.length, 0);
                      return (
                        <li key={section.id}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                              included
                                ? 'border-zinc-700 bg-zinc-900'
                                : 'border-zinc-800 bg-zinc-950'
                            )}
                          >
                            <Checkbox
                              checked={included}
                              onCheckedChange={() => toggleSection(section.id)}
                              aria-label={`Import ${section.label}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  'block text-sm font-semibold',
                                  included ? 'text-zinc-100' : 'text-zinc-500'
                                )}
                              >
                                {section.label}
                              </span>
                              <span className="mt-0.5 block text-xs text-zinc-500">
                                {section.items.length}{' '}
                                {section.items.length === 1 ? 'entry' : 'entries'}
                                {bulletCount > 0 && ` · ${bulletCount} bullets`}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <p className="mt-5 mb-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                    How to import
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {MODE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = option.id === mode;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setMode(option.id)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-semibold transition-colors',
                            isSelected
                              ? 'border-amber-600 bg-amber-950 text-zinc-100'
                              : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                          )}
                          aria-pressed={isSelected}
                        >
                          <Icon
                            className={cn(
                              'size-4',
                              isSelected ? 'text-amber-500' : 'text-zinc-500'
                            )}
                          />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {MODE_OPTIONS.find((option) => option.id === mode)?.hint}
                  </p>
                </>
              )}
            </div>

            <DialogFooter className="border-t border-zinc-800 bg-zinc-900 px-5 py-3">
              <Button variant="outline" onClick={() => setStep('paste')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={includedSections.length === 0}>
                {mode === 'replace' ? 'Replace resume' : 'Add to resume'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
