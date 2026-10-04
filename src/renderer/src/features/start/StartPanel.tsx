import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { ArrowRight, FileText, Info, Lock, Sparkles, Upload, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { MosaicMark } from '@/components/MosaicMark';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { cn } from '@/lib/utils';
import { matchesAction, useShortcutLabel } from '@/features/shortcuts/shortcutBindings';
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
  const newTemplateKeys = useShortcutLabel('newTemplate');

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
      // New template's keys, pressed here, mean the blank resume.
      if (matchesAction(event, 'newTemplate')) {
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
        className="max-h-full w-full max-w-140 overflow-auto rounded-[0.8125rem] border border-line-strong bg-pane px-6 pt-6 pb-3.5 shadow-overlay"
      >
        {view === 'routes' ? (
          <>
            <PanelHead
              mark={<MosaicMark size="md" />}
              title={first ? 'Start your first resume' : 'Start a new resume'}
              subtitle="Mosaic keeps everything on your computer. Your drafts and history never leave it."
              onClose={closable ? close : undefined}
            />
            <div className="flex flex-col gap-1.75" onKeyDown={moveFocusWithArrows}>
              <StartRoute
                icon={FileText}
                title="Blank resume"
                description="Experience, Education and Skills, all empty."
                hint={newTemplateKeys}
                onClick={() => void startBlank()}
                autoFocus
              />
              <StartRoute
                icon={Upload}
                title="Import what you have"
                description="Word, Markdown, plain text, or a Mosaic backup from another computer."
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
              <AppButton
                variant="option"
                size="xs"
                shape="card"
                data-start-option
                onClick={() => void startFromSample()}
                onPointerMove={focusOnPointer}
                className="flex-col justify-center gap-2.25 font-control text-ink-soft"
                autoFocus
              >
                <SlotPaper />
                Example resume
              </AppButton>
              <div className={SLOT}>
                <SlotPaper />
                More coming
              </div>
            </div>
            <PanelFoot icon={Info}>
              One sample so far. More are being written.
              <AppButton
                variant="outline"
                size="xs"
                className="ml-auto"
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
        <Text as="h1" id="start-title" variant="heading" className="mb-1.25 block">
          {title}
        </Text>
        <Text as="p" variant="secondary" className="text-pretty">
          {subtitle}
        </Text>
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
    <Text
      as="div"
      variant="secondary"
      className="mt-4 flex items-center gap-1.75 border-t border-line pt-3 text-ink-faint"
    >
      <Icon className="size-3 shrink-0" />
      {children}
    </Text>
  );
}

/** A route's icon; it turns amber with its route while that route is the one in focus. */
function RouteIcon({ icon: Icon }: { icon: typeof Lock }) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[0.5625rem] border border-line-strong bg-line text-ink-soft transition-colors',
        'group-focus/route:border-amber-line group-focus/route:bg-amber-soft group-focus/route:text-amber'
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

/** A sample still to come: the option's shape, dashed, with nothing to press. */
const SLOT = cn(
  textVariantClasses('secondary'),
  'flex flex-col items-center gap-2.25 rounded-[0.5625rem] border border-dashed border-line-heavy p-3 text-ink-faint'
);

/**
 * One highlight, as in a menu: the amber edge marks the focused option, which is the one
 * Enter picks. Moving the pointer over an option focuses it, and the arrow keys move focus
 * too (`moveFocusWithArrows`), so hover and keyboard never disagree. Only a real move: the
 * browser also reports one, standing still, when the layout shifts under a resting pointer,
 * and that must not take the focus the panel opened with.
 */
const focusOnPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
  const hasMoved = event.movementX !== 0 || event.movementY !== 0;
  if (hasMoved && document.activeElement !== event.currentTarget) {
    event.currentTarget.focus({ preventScroll: true });
  }
};

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
    <AppButton
      variant="option"
      shape="card"
      data-start-option
      onClick={onClick}
      onPointerMove={focusOnPointer}
      autoFocus={autoFocus}
      className="group/route w-full gap-3 px-3.25"
    >
      <RouteIcon icon={icon} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Text variant="strong">{title}</Text>
        <Text variant="secondary">{description}</Text>
      </span>
      {hint && (
        <Text
          as="kbd"
          variant="caption"
          className="shrink-0 rounded-[0.3125rem] border border-line-strong px-1.25 py-0.5"
        >
          {hint}
        </Text>
      )}
      <ArrowRight className="size-3.5 shrink-0 text-ink-faint" />
    </AppButton>
  );
}

/** A stand-in page: ruled lines where a resume's text would be. */
function SlotPaper() {
  return (
    <span
      aria-hidden
      className="block h-26 w-full rounded-[0.1875rem] border border-line-strong bg-[repeating-linear-gradient(var(--line)_0_0.4375rem,transparent_0.4375rem_0.5625rem)]"
    />
  );
}
