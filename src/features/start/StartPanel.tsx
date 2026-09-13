import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, FileText, Info, Lock, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isModKey, shortcutLabel } from '@/lib/shortcuts';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import { useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { createBlankResume } from './blankResume';
import { useStartResume } from './useStartResume';

/*
 * How a resume starts: blank, from an import, or from a sample. It sits over the
 * workspace rather than in a modal — the app behind it is the real one, already empty.
 * At a launch with no templates it is the only way forward; opened from New template, it
 * can close.
 */

interface StartPanelProps {
  /** There are templates to go back to, so the panel can be dismissed. */
  closable: boolean;
}

export function StartPanel({ closable }: StartPanelProps) {
  const [view, setView] = useState<'routes' | 'samples'>('routes');
  const first = useTemplateStore((s) => s.templates.length === 0);
  const setStartOpen = useOverlayStore((s) => s.setStartOpen);
  const openImport = useOverlayStore((s) => s.openImport);
  const start = useStartResume();

  const startBlank = () =>
    start(
      'Untitled resume',
      createBlankResume(),
      first
        ? 'Created “Untitled resume” — your first template, autosaving as you type'
        : 'Created “Untitled resume”'
    );

  const startFromSample = () =>
    start('Example resume', createDefaultResume(), 'Created “Example resume” from the sample');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isModKey(event) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        void startBlank();
      }
      if (event.key === 'Escape' && closable) setStartOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    // The workspace stays visible, dimmed and blurred, behind the card.
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-auto bg-[color-mix(in_srgb,var(--background)_78%,transparent)] p-5 backdrop-blur-[3px]">
      <section
        aria-labelledby="start-title"
        className="max-h-full w-full max-w-[35rem] overflow-auto rounded-xl border border-zinc-300 bg-white px-6 pt-6 pb-3.5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        {view === 'routes' ? (
          <>
            <PanelHead
              mark={<MosaicMark />}
              title={first ? 'Start your first resume' : 'Start a new resume'}
              subtitle="Mosaic keeps everything on this machine — your drafts, history and exports never leave it."
              onClose={closable ? () => setStartOpen(false) : undefined}
            />
            <div className="flex flex-col gap-2">
              <StartRoute
                icon={FileText}
                primary
                title="Blank resume"
                description="Experience, Education and Skills, all empty."
                hint={shortcutLabel('N')}
                onClick={() => void startBlank()}
                autoFocus
              />
              <StartRoute
                icon={Upload}
                title="Import what you have"
                description="Paste the text of the resume you already have."
                onClick={() => openImport(true)}
              />
              <StartRoute
                icon={Sparkles}
                title="Start from a sample"
                description="A finished resume to edit instead of a blank page."
                onClick={() => setView('samples')}
              />
            </div>
            <PanelFoot icon={Lock}>
              No account, no sync. The AI assistant is off unless you choose to set it up.
            </PanelFoot>
          </>
        ) : (
          <>
            <PanelHead
              mark={<RouteIcon icon={Sparkles} />}
              title="Samples"
              subtitle="Pick one and it opens as a new template, fully editable."
              onClose={closable ? () => setStartOpen(false) : undefined}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void startFromSample()}
                className="flex flex-col items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                autoFocus
              >
                <SlotPaper />
                Example resume
              </button>
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700">
                <SlotPaper />
                More coming
              </div>
            </div>
            <PanelFoot icon={Info}>
              One sample so far — more are being written.
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => setView('routes')}
              >
                Back
              </Button>
            </PanelFoot>
          </>
        )}
      </section>
    </div>
  );
}

function PanelHead({
  mark,
  title,
  subtitle,
  onClose,
}: {
  mark: ReactNode;
  title: string;
  subtitle: string;
  onClose?: () => void;
}) {
  return (
    <div className="mb-5 flex items-start gap-3.5">
      <div className="mt-0.5 shrink-0">{mark}</div>
      <div className="min-w-0 flex-1">
        <h1
          id="start-title"
          className="mb-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          {title}
        </h1>
        <p className="text-xs leading-normal text-pretty text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>
      </div>
      {onClose && (
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

function PanelFoot({ icon: Icon, children }: { icon: typeof Lock; children: ReactNode }) {
  return (
    <div className="mt-4 flex items-center gap-2 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
      <Icon className="size-3 shrink-0" />
      {children}
    </div>
  );
}

/** The app's mark, as in the top bar. */
function MosaicMark() {
  return (
    <div className="flex size-8.5 items-center justify-center rounded-lg bg-amber-500 text-base font-bold text-white">
      M
    </div>
  );
}

function RouteIcon({ icon: Icon, primary }: { icon: typeof Lock; primary?: boolean }) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-lg border',
        primary
          ? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400'
          : 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

interface StartRouteProps {
  icon: typeof Lock;
  title: string;
  description: string;
  hint?: string;
  primary?: boolean;
  autoFocus?: boolean;
  onClick: () => void;
}

function StartRoute({
  icon,
  title,
  description,
  hint,
  primary,
  autoFocus,
  onClick,
}: StartRouteProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border bg-zinc-50 p-3 text-left text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
        primary
          ? 'border-zinc-400 dark:border-zinc-700'
          : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-700'
      )}
    >
      <RouteIcon icon={icon} primary={primary} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">{description}</span>
      </span>
      {hint && (
        <kbd className="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 font-sans text-[0.65rem] text-zinc-500 dark:border-zinc-700">
          {hint}
        </kbd>
      )}
      <ArrowRight className="size-3.5 shrink-0 text-zinc-500" />
    </button>
  );
}

/** A stand-in page: ruled lines where a resume's text would be. */
function SlotPaper() {
  return (
    <span
      aria-hidden
      className="block h-26 w-full rounded-sm border border-zinc-300 bg-[repeating-linear-gradient(var(--color-zinc-200)_0_0.45rem,transparent_0.45rem_0.6rem)] dark:border-zinc-700 dark:bg-[repeating-linear-gradient(var(--color-zinc-800)_0_0.45rem,transparent_0.45rem_0.6rem)]"
    />
  );
}
