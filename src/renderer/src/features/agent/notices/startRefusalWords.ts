import type { NoticeRefusalReason } from '@/stores/agentNoticeStore';
import type { NoticeAction, NoticeWords } from './noticeWords';

/*
 * What the pane says when main won't start a run. Each needs the user before anything can
 * run, so each is a "Can’t run" notice, and the message stays in the box.
 */

interface RefusalWords {
  sentence: string;
  did: string;
  actions: NoticeAction[];
}

const NOT_SENT = 'Not sent. Your message is still in the box.';

const WORDS: Record<NoticeRefusalReason, (provider: string) => RefusalWords> = {
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
  assistantOff: () => ({
    sentence: 'The assistant is off in Settings.',
    did: NOT_SENT,
    actions: [{ kind: 'settings', label: 'Open Settings' }],
  }),
};

/** For the provider and model chosen now, which the message would have used. */
export function describeStartRefusal(
  refusal: NoticeRefusalReason,
  chosen: { providerLabel: string; model: string }
): NoticeWords {
  return {
    ...WORDS[refusal](chosen.providerLabel),
    kind: refusal,
    level: 'cantRun',
    who: `${chosen.providerLabel} · ${chosen.model}`,
    quoted: null,
    isKeptShown: false,
  };
}

/** A send that came back the same: nothing was sent, so it was checked. */
export const formatCheckedAgain = (time: string): string =>
  `Checked again at ${time}. Same answer.`;
