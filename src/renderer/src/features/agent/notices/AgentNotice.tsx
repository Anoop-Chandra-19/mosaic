import { useState } from 'react';
import { Check, Copy, ExternalLink, Lock, Settings, TriangleAlert, X } from 'lucide-react';
import { AppButton, Text, textVariantClasses } from '@/components/ui-kit';
import { foldAway } from '@/lib/motion/presenceMotions';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';
import { cn } from '@/lib/utils';
import {
  NOTICE_TAGS,
  type NoticeAction,
  type NoticeLevel,
  type NoticeWords,
  type QuotedWords,
} from './noticeWords';
import type { NoticeChoice } from './pickNotice';

/*
 * The one notice over the prompt box, for anything that needs the user: a message main
 * wouldn't start, or a run that stopped. In order: the tag and who, the sentence, the
 * words quoted as they came with their status, what Mosaic did, the kept line, then the
 * actions. It rises in, pulses once for a same answer, and folds away when it goes.
 */

/** What the notice can't do itself: everything but copying. */
export type NoticeHandledAction = Exclude<NoticeAction, { kind: 'link' | 'command' | 'copy' }>;

const LEVEL_CLASSES: Record<NoticeLevel, { box: string; tag: string }> = {
  cantRun: { box: 'border-warn-line', tag: 'bg-warn text-warn-ink' },
  stopped: {
    box: 'border-line-strong',
    tag: 'border border-warn-line bg-warn-soft text-warn-text',
  },
};

/** The likeliest fix: the one marked, or the first that is a button. */
function findPrimaryIndex(actions: NoticeAction[]): number {
  const marked = actions.findIndex((action) => action.kind === 'again' && action.isPrimary);
  if (marked >= 0) return marked;
  return actions.findIndex((action) => action.kind !== 'link' && action.kind !== 'command');
}

function useCopied(text: string): { isCopied: boolean; copy: () => void } {
  const [isCopied, setIsCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1400);
    });
  };
  return { isCopied, copy };
}

function CommandAction({ command }: { command: string }) {
  const { isCopied, copy } = useCopied(command);
  return (
    <div className="flex h-7.5 min-w-0 flex-[1_1_100%] items-center gap-1.75 rounded-sm border border-line-strong bg-pane pr-0.75 pl-2.25">
      <code className={cn(textVariantClasses('meta'), 'min-w-0 flex-1 truncate text-foreground')}>
        <span className="mr-1.5 text-ink-faint">$</span>
        {command}
      </code>
      <AppButton size="xs" variant="outline" onClick={copy} className="h-6 px-2">
        {isCopied ? <Check className="size-2.75" /> : <Copy className="size-2.75" />}
        {isCopied ? 'Copied' : 'Copy'}
      </AppButton>
    </div>
  );
}

function CopyAction({
  label,
  text,
  isPrimary,
}: {
  label: string;
  text: string;
  isPrimary: boolean;
}) {
  const { isCopied, copy } = useCopied(text);
  return (
    <AppButton size="xs" variant={isPrimary ? 'solid' : 'outline'} onClick={copy}>
      {isCopied ? <Check className="size-2.75" /> : <Copy className="size-2.75" />}
      {isCopied ? 'Copied' : label}
    </AppButton>
  );
}

/** A provider's page, in the browser: the app never navigates away from itself. */
function LinkAction({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`Opens ${new URL(url).host} in your browser`}
      className="inline-flex h-6.5 items-center gap-1 px-0.5 text-support font-control text-ink-soft underline decoration-line-heavy underline-offset-3 hover:text-foreground hover:decoration-ink-faint [&_svg]:text-ink-faint"
    >
      {label}
      <ExternalLink aria-hidden className="size-2.75" />
    </a>
  );
}

interface NoticeActionsProps {
  actions: NoticeAction[];
  isSending: boolean;
  onAction: (action: NoticeHandledAction) => void;
}

function NoticeActions({ actions, isSending, onAction }: NoticeActionsProps) {
  const primaryIndex = findPrimaryIndex(actions);
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-2.5 pt-2.25 pb-2.5">
      {actions.map((action, index) => {
        const key = `${action.kind}-${index}`;
        if (action.kind === 'command') return <CommandAction key={key} command={action.command} />;
        if (action.kind === 'link')
          return <LinkAction key={key} label={action.label} url={action.url} />;
        if (action.kind === 'copy') {
          return (
            <CopyAction
              key={key}
              label={action.label}
              text={action.text}
              isPrimary={index === primaryIndex}
            />
          );
        }
        return (
          <AppButton
            key={key}
            size="xs"
            variant={index === primaryIndex ? 'solid' : 'outline'}
            disabled={isSending}
            onClick={() => onAction(action)}
          >
            {action.kind === 'settings' && <Settings className="size-2.75" />}
            {action.kind === 'again' && isSending ? 'Sending…' : action.label}
          </AppButton>
        );
      })}
    </div>
  );
}

/** Someone else's words, as they came, with their status. */
export function QuotedBlock({ quoted }: { quoted: QuotedWords }) {
  return (
    <div className="mx-2.5 mt-1.75 rounded-sm bg-line px-2 pt-1.5 pb-1.75">
      <div className="flex items-baseline gap-1.5">
        <Text variant="caption">{quoted.label}</Text>
        {quoted.code && (
          <Text variant="meta" className="font-control text-ink-soft">
            {quoted.code}
          </Text>
        )}
      </div>
      <Text
        as="p"
        variant="meta"
        // A provider's message can be any length; it scrolls, so the actions stay near.
        className="mt-0.5 max-h-24 overflow-y-auto wrap-anywhere whitespace-pre-wrap text-ink-soft"
        tabIndex={0}
      >
        {quoted.text}
      </Text>
    </div>
  );
}

interface AgentNoticeProps {
  words: NoticeWords;
  isSending: boolean;
  checked: string | null;
  isPulsing: boolean;
  onAction: (action: NoticeHandledAction) => void;
  onDismiss: () => void;
}

export function AgentNotice({
  words,
  isSending,
  checked,
  isPulsing,
  onAction,
  onDismiss,
}: AgentNoticeProps) {
  const level = LEVEL_CLASSES[words.level];
  const tag = NOTICE_TAGS[words.level];
  return (
    <div
      role={words.level === 'cantRun' ? 'alert' : 'status'}
      aria-label={`${tag}. ${words.sentence}`}
      className={cn(
        'overflow-hidden rounded-[0.5625rem] border bg-pane-sunken motion-reduce:animate-none',
        level.box,
        isPulsing ? 'animate-notice-pulse' : 'animate-notice-rise'
      )}
    >
      <div className="flex min-h-6.25 items-center gap-2 pt-1.75 pr-1.5 pl-2.5">
        <Text
          variant="tag"
          className={cn(
            'inline-flex h-4.5 shrink-0 items-center gap-1 rounded-[0.25rem] px-1.5',
            level.tag
          )}
        >
          <TriangleAlert className="size-2.5" strokeWidth={2.6} />
          {tag}
        </Text>
        <Text variant="meta" className="min-w-0 flex-1 truncate" title={words.who}>
          {words.who}
        </Text>
        {words.level === 'stopped' && (
          <AppButton
            variant="ghost"
            size="2xs"
            shape="square"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <X className="size-2.75" />
          </AppButton>
        )}
      </div>
      <Text as="p" variant="strong" className="px-2.5 pt-1.5 text-pretty">
        {words.sentence}
      </Text>
      {words.quoted && <QuotedBlock quoted={words.quoted} />}
      {(words.did || checked) && (
        <Text as="p" variant="secondary" className="mx-2.5 mt-1.5 text-pretty">
          {words.did}
          {words.did && checked && ' '}
          {checked && <span className="text-foreground">{checked}</span>}
        </Text>
      )}
      {words.isKeptShown && (
        <Text as="p" variant="secondary" className="mx-2.5 mt-1 flex items-center gap-1.5">
          <Lock aria-hidden className="size-2.75 shrink-0 text-ink-faint" />
          Your suggestions so far are kept.
        </Text>
      )}
      <NoticeActions actions={words.actions} isSending={isSending} onAction={onAction} />
    </div>
  );
}

interface AgentNoticeSlotProps {
  choice: NoticeChoice;
  onAction: (action: NoticeHandledAction) => void;
  onDismiss: () => void;
}

/**
 * Where the notice sits, just before the prompt box, so Shift+Tab from the box reaches it.
 * In a short window it scrolls rather than push the box out of the pane.
 */
export function AgentNoticeSlot({ choice, onAction, onDismiss }: AgentNoticeSlotProps) {
  const { shown, isLeaving, ref } = usePresenceMotion(
    choice.notice,
    choice.notice?.key ?? null,
    foldAway
  );
  return (
    <>
      <span className="sr-only" aria-live="polite">
        {choice.announcement}
      </span>
      {shown && (
        <div
          key={shown.key}
          ref={ref}
          data-notice-slot
          inert={isLeaving}
          aria-hidden={isLeaving || undefined}
          className="min-h-0 overflow-y-auto border-t border-line bg-pane px-2.75 pt-2.25"
        >
          <AgentNotice
            key={shown.pulseKey}
            words={shown.words}
            isSending={shown.isSending}
            checked={shown.checked}
            isPulsing={shown.pulseKey !== 0}
            onAction={onAction}
            onDismiss={onDismiss}
          />
        </div>
      )}
    </>
  );
}
