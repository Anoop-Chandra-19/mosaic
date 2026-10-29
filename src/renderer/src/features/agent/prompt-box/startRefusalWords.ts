import type { AgentStartRefusal } from '@shared/types/agentBridge';

/*
 * What the pane says when main won't start a run. Each needs the user before anything can
 * run, so each is a "Can’t run" notice over the prompt box, and the message stays in the box.
 */

/** `again` sends the box's message again; `openRunning` goes to the conversation running. */
export type StartNoticeActionKind = 'settings' | 'again' | 'openRunning';

export interface StartNoticeAction {
  kind: StartNoticeActionKind;
  label: string;
}

export interface StartRefusalWords {
  sentence: string;
  /** What Mosaic did, and what happened to the message. */
  did: string;
  actions: StartNoticeAction[];
}

const NOT_SENT = 'Not sent. Your message is still in the box.';

const WORDS: Record<AgentStartRefusal, (provider: string) => StartRefusalWords> = {
  noApiKey: (provider) => ({
    sentence: `Add your ${provider} API key in Settings to use it.`,
    did: NOT_SENT,
    actions: [{ kind: 'settings', label: 'Add key in Settings' }],
  }),
  keychainRefused: (provider) => ({
    sentence: `Your keychain didn’t give Mosaic your ${provider} API key.`,
    did: `It may be locked, or its prompt was turned down. ${NOT_SENT}`,
    actions: [
      { kind: 'again', label: 'Send again' },
      { kind: 'settings', label: 'Open Settings' },
    ],
  }),
  runInProgress: () => ({
    sentence: 'The assistant is still working in another conversation.',
    did: `It works on one thing at a time. ${NOT_SENT}`,
    actions: [{ kind: 'openRunning', label: 'Go to it' }],
  }),
  assistantOff: () => ({
    sentence: 'The assistant is off in Settings.',
    did: NOT_SENT,
    actions: [{ kind: 'settings', label: 'Open Settings' }],
  }),
};

export const describeStartRefusal = (
  refusal: AgentStartRefusal,
  provider: string
): StartRefusalWords => WORDS[refusal](provider);
