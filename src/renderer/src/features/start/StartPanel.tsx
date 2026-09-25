import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { ArrowRight, FileText, Info, Lock, Sparkles, Upload, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import { isModKey, shortcutLabel } from '@/lib/keyboardShortcuts';
import { createDefaultResume } from '@shared/resume/defaultResume';
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
  const closeSurface = useOverlayStore((s) => s.closeSurface);
  const close = () => closeSurface('start');
  const openImport = useOverlayStore((s) => s.openImport);
  const start = useStartResume();

  const startBlank = () =>
    start(
      'Untitled resume',
      createBlankResume(),
      first
        ? 'Created “Untitled resume”, your first template. It saves as you type.'
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
      if (event.key === 'Escape' && closable) close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    // The workspace stays visible, dimmed and blurred, behind the card.
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-auto bg-[color-mix(in_srgb,var(--background)_78%,transparent)] p-5 backdrop-blur-[3px]">
      <section
        aria-labelledby="start-title"
        className="max-h-full w-full max-w-140 overflow-auto rounded-xl border border-line-strong bg-white px-6 pt-6 pb-3.5 shadow-2xl dark:bg-zinc-950"
      >
        {view === 'routes' ? (
          <>
            <PanelHead
              mark={<MosaicMark />}
              title={first ? 'Start your first resume' : 'Start a new resume'}
              subtitle="Mosaic keeps everything on this machine. Your drafts, history and exports never leave it."
              onClose={closable ? close : undefined}
            />
            <div className="flex flex-col gap-2" onKeyDown={moveFocusWithArrows}>
              <StartRoute
                icon={FileText}
                title="Blank resume"
                description="Experience, Education and Skills, all empty."
                hint={shortcutLabel('N')}
                onClick={() => void startBlank()}
                autoFocus
              />
              <StartRoute
                icon={Upload}
                title="Import what you have"
                description="Word, Markdown, plain text, or a Mosaic backup from another machine."
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
              onClose={closable ? close : undefined}
            />
            <div className="grid grid-cols-2 gap-2.5" onKeyDown={moveFocusWithArrows}>
              <button
                type="button"
                data-start-option
                onClick={() => void startFromSample()}
                onPointerEnter={focusOnPointer}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border border-line-strong bg-zinc-50 p-3 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                  OPTION_HIGHLIGHT
                )}
                autoFocus
              >
                <SlotPaper />
                Example resume
              </button>
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-heavy p-3 text-xs text-zinc-500">
                <SlotPaper />
                More coming
              </div>
            </div>
            <PanelFoot icon={Info}>
              One sample so far. More are being written.
              <AppButton
                variant="outline"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => setView('routes')}
              >
                Back
              </AppButton>
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
        <AppButton variant="ghost" size="sm" shape="square" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </AppButton>
      )}
    </div>
  );
}

function PanelFoot({ icon: Icon, children }: { icon: typeof Lock; children: ReactNode }) {
  return (
    <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-zinc-500">
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

/** A route's icon; it turns amber with its route while that route is the one in focus. */
function RouteIcon({ icon: Icon }: { icon: typeof Lock }) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-zinc-100 text-zinc-600 transition-colors dark:bg-zinc-800 dark:text-zinc-300',
        'group-focus/route:border-amber-300 group-focus/route:bg-amber-50 group-focus/route:text-amber-600 dark:group-focus/route:border-amber-800 dark:group-focus/route:bg-amber-950 dark:group-focus/route:text-amber-400'
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
  autoFocus?: boolean;
  onClick: () => void;
}

/**
 * One highlight, as in a menu: the amber marks the focused option, which is the one Enter
 * picks. The pointer moves focus as it goes over an option, and the arrow keys move it too
 * (`moveFocusWithArrows`), so hover and keyboard never disagree.
 */
const OPTION_HIGHLIGHT =
  'transition-colors outline-none focus:border-amber-500 focus:bg-zinc-100 dark:focus:border-amber-600 dark:focus:bg-zinc-800';

/** Pointing at an option focuses it, so the highlight follows the pointer. */
const focusOnPointer = (event: ReactPointerEvent<HTMLButtonElement>) =>
  event.currentTarget.focus({ preventScroll: true });

/** Up/Down and Left/Right move between a group's options, wrapping; Home and End jump. */
function moveFocusWithArrows(event: ReactKeyboardEvent<HTMLElement>) {
  const options = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-start-option]'),
  ];
  const at = options.indexOf(document.activeElement as HTMLButtonElement);
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  let next: number | undefined;
  if (step !== undefined) next = (at + step + options.length) % options.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = options.length - 1;
  if (next === undefined || options.length === 0) return;
  event.preventDefault();
  options[next].focus();
}

function StartRoute({ icon, title, description, hint, autoFocus, onClick }: StartRouteProps) {
  return (
    <button
      type="button"
      data-start-option
      onClick={onClick}
      onPointerEnter={focusOnPointer}
      autoFocus={autoFocus}
      className={cn(
        'group/route flex w-full items-center gap-3 rounded-lg border border-line-strong bg-zinc-50 p-3 text-left text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100',
        OPTION_HIGHLIGHT
      )}
    >
      <RouteIcon icon={icon} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">{description}</span>
      </span>
      {hint && (
        <kbd className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-sans text-[0.65rem] text-zinc-500">
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
      className="block h-26 w-full rounded-sm border border-line-strong bg-[repeating-linear-gradient(var(--color-zinc-200)_0_0.45rem,transparent_0.45rem_0.6rem)] dark:bg-[repeating-linear-gradient(var(--color-zinc-800)_0_0.45rem,transparent_0.45rem_0.6rem)]"
    />
  );
}
