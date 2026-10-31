/*
 * What a notice over the prompt box says, whatever it is about: a message main wouldn't
 * start (`startRefusalWords.ts`) or a run that stopped (`stopWords.ts`). `AgentNotice`
 * draws it; the pane decides which one shows (`pickNotice.ts`).
 */

/**
 * `cantRun` is true until the user fixes something outside the conversation, so it has no
 * dismiss; `stopped` is about one run, and can be dismissed.
 */
export type NoticeLevel = 'cantRun' | 'stopped';

/**
 * `again` sends the conversation again (Send again, Carry on, Try again); `ask` puts the
 * cursor back in the box; `openRunning` goes to the conversation running.
 */
export type NoticeAction =
  | { kind: 'again'; label: string; isPrimary?: boolean }
  | { kind: 'settings'; label: string }
  | { kind: 'link'; label: string; url: string }
  | { kind: 'command'; command: string }
  | { kind: 'copy'; label: string; text: string }
  | { kind: 'ask'; label: string }
  | { kind: 'newConversation'; label: string }
  | { kind: 'openRunning'; label: string };

/** Someone else's words, shown as they came: the provider's, your computer's, Mosaic's check's. */
export interface QuotedWords {
  label: string;
  /** The HTTP status, when there was one. */
  code: string | null;
  text: string;
}

export interface NoticeWords {
  /** Which notice this is, so an answer to Send again can say it is the same one. */
  kind: string;
  level: NoticeLevel;
  /** Provider and model, as the notice's source line. */
  who: string;
  sentence: string;
  quoted: QuotedWords | null;
  /** What Mosaic did about it. */
  did: string | null;
  /** Whether to say the run's suggestions are kept: only a run that started has any. */
  isKeptShown: boolean;
  actions: NoticeAction[];
}

export const NOTICE_TAGS: Record<NoticeLevel, string> = {
  cantRun: 'Can’t run',
  stopped: 'Run stopped',
};
