import type { HeaderItemKind } from '../../types/resume';
import { HEADER_ALIGNS, LINK_COLORS, LINK_STYLES } from '../resumeHeader';
import type { FormattingChange, FormattingSetting } from './diffFormatting';
import {
  getChangeTone,
  type Change,
  type ChangeLine,
  type ChangeTone,
  type EntryField,
} from './resumeChange';

const FIELD_NAMES: Record<EntryField, string> = {
  title: 'Role',
  organization: 'Company',
  location: 'Location',
  dates: 'Dates',
};

const ITEM_NAMES: Record<HeaderItemKind, string> = {
  phone: 'Phone',
  email: 'Email',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  site: 'Website',
  location: 'Location',
  auth: 'Work authorization',
  custom: 'Header item',
};

export interface ChangeWording {
  noun: string;
  verb: string;
  detail: string | null;
}

function nameChangedThing(change: Change): string {
  switch (change.line) {
    case 'bullet':
      return `Bullet ${change.n ?? ''}`.trim();
    case 'entry':
    case 'text':
      return change.label || 'Entry';
    case 'section':
      return change.kind === 'rename' ? 'Section name' : (change.text ?? '');
    case 'field':
      return change.field ? FIELD_NAMES[change.field] : 'Field';
    case 'item':
      return change.itemKind ? ITEM_NAMES[change.itemKind] : 'Header item';
    case 'summary':
      return 'Summary';
    case 'name':
      return 'Name';
  }
}

/** One wording for the change list, the unified view, and the banner. */
export function describeChange(change: Change): ChangeWording {
  const kindWord = change.line === 'entry' ? 'entry ' : change.line === 'section' ? 'section ' : '';
  let verb: string;
  if (change.kind === 'reorder') {
    verb = change.rel === 'to' ? `moved to ${change.other}` : `moved ${change.rel} ${change.other}`;
    if (change.was) verb += ` (${change.was})`;
  } else if (change.kind === 'toggle') {
    verb = kindWord + (change.isOnPage ? 'back on the page' : 'left off the page');
  } else if (change.kind === 'add') {
    verb = `${kindWord}added`;
  } else if (change.kind === 'remove') {
    verb = `${kindWord}removed`;
  } else if (change.phrases) {
    verb = change.line === 'summary' ? 'reworded' : 'edited';
  } else if (!change.from) {
    verb = 'added';
  } else if (!change.to) {
    verb = 'cleared';
  } else {
    verb = change.line === 'section' || change.field === 'title' ? 'renamed' : 'changed';
  }
  const isShortField = !change.phrases && change.from !== undefined && change.kind !== 'toggle';
  const detail = isShortField
    ? change.from && change.to
      ? `${change.from} → ${change.to}`
      : change.from || change.to || null
    : null;
  return { noun: nameChangedThing(change), verb, detail };
}

export interface DifferencePhrase {
  text: string;
  tone: ChangeTone;
}

export interface DifferenceWording {
  /** What the page being read has that the other side doesn't. */
  has: DifferencePhrase[];
  missing: DifferencePhrase[];
  where: string[];
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const count = (n: number, one: string, many: string) => `${n} ${plural(n, one, many)}`;

/** What a line is called when counted. A summary or text line is just a line. */
const THING_NAMES: Record<ChangeLine, [string, string]> = {
  name: ['name', 'names'],
  item: ['header item', 'header items'],
  section: ['section', 'sections'],
  entry: ['entry', 'entries'],
  field: ['field', 'fields'],
  bullet: ['bullet', 'bullets'],
  summary: ['line', 'lines'],
  text: ['line', 'lines'],
};

const DIFFERENT_FIELDS: Record<EntryField, [string, string]> = {
  title: ['a different role', 'different roles'],
  organization: ['a different company', 'different companies'],
  location: ['a different location', 'different locations'],
  dates: ['different dates', 'different dates'],
};

const WORDED_DIFFERENTLY: Partial<Record<ChangeLine, (n: number) => string>> = {
  name: () => 'a different name',
  item: (n) => (n === 1 ? 'a different header item' : `${n} different header items`),
  section: (n) => (n === 1 ? 'a renamed section' : `${n} renamed sections`),
  bullet: (n) => `${count(n, 'bullet', 'bullets')} worded differently`,
  summary: () => 'a reworded summary',
  text: (n) => `${count(n, 'line', 'lines')} worded differently`,
};

/** One phrase of the sentence; changes with the same `key` are counted into it. */
interface PhraseKind {
  key: string;
  isMissing: boolean;
  tone: ChangeTone;
  write: (n: number) => string;
}

function classifyDifference(change: Change): PhraseKind | null {
  const tone = getChangeTone(change);
  const [one, many] = THING_NAMES[change.line];
  if (change.kind === 'reorder') {
    return {
      key: `moved ${one}`,
      isMissing: false,
      tone: 'edit',
      write: (n) => `${count(n, one, many)} in a different place`,
    };
  }
  if (change.kind === 'add' || change.kind === 'remove' || change.kind === 'toggle') {
    const isMissing = tone !== 'add';
    if (change.line === 'summary') {
      return {
        key: isMissing ? 'missing summary' : 'extra summary',
        isMissing,
        tone,
        write: () => (isMissing ? 'the summary' : 'a summary'),
      };
    }
    return {
      key: `${isMissing ? 'missing' : 'extra'} ${one}`,
      isMissing,
      tone,
      write: (n) => (isMissing ? count(n, one, many) : `${n} extra ${plural(n, one, many)}`),
    };
  }
  if (change.line === 'field' && change.field) {
    const [single, several] = DIFFERENT_FIELDS[change.field];
    return {
      key: `field ${change.field}`,
      isMissing: false,
      tone,
      write: (n) => `${plural(n, single, several)} on ${count(n, 'entry', 'entries')}`,
    };
  }
  const write = WORDED_DIFFERENTLY[change.line];
  return write ? { key: `edited ${change.line}`, isMissing: false, tone: 'edit', write } : null;
}

/**
 * The banner's sentence, in parts: it describes the page being read against the other side
 * ("it has 1 extra bullet … and is missing 1 entry"), never bare +1 / −1.
 */
export function describeDifference(changes: readonly Change[]): DifferenceWording {
  const groups = new Map<string, { phrase: PhraseKind; n: number }>();
  for (const change of changes) {
    const phrase = classifyDifference(change);
    if (!phrase) continue;
    const group = groups.get(phrase.key) ?? { phrase, n: 0 };
    group.n++;
    groups.set(phrase.key, group);
  }

  const has: DifferencePhrase[] = [];
  const missing: DifferencePhrase[] = [];
  for (const { phrase, n } of groups.values()) {
    (phrase.isMissing ? missing : has).push({ text: phrase.write(n), tone: phrase.tone });
  }

  const where = new Set<string>();
  for (const change of changes) {
    if (change.line === 'item' || change.line === 'name') where.add('the header');
    else if (change.line !== 'summary') where.add(change.where.split(' › ')[0]);
  }
  return { has, missing, where: [...where] };
}

/** `value` is the page being read's, in a sentence; `setting`, `from` and `to` use Settings' labels. */
export interface FormattingWording {
  subject: string;
  value: string;
  otherValue: string;
  row: string;
  setting: string;
  from: string;
  to: string;
}

interface SettingWords {
  name: string;
  /** In a sentence: "underlined", "separated by “·”". */
  describe: (value: string) => string;
  /** The other side's, once the setting has been named, where it differs: "by “|”". */
  describeOther?: (value: string) => string;
  /** Settings' own label: "Underlined", "·". */
  label: (value: string) => string;
}

const wordFor = (words: Record<string, string>) => (value: string) => words[value] ?? value;
const labelFor = (options: readonly { value: string; label: string }[]) => (value: string) =>
  options.find((option) => option.value === value)?.label ?? value;
const quoteSeparator = (separator: string) =>
  separator.trim() ? `“${separator.trim()}”` : 'spaces';

const SETTING_WORDS: Record<FormattingSetting, SettingWords> = {
  linkStyle: {
    name: 'Links',
    describe: wordFor({ underline: 'underlined', plain: 'plain' }),
    label: labelFor(LINK_STYLES),
  },
  linkColor: {
    name: 'Link color',
    describe: wordFor({ blue: 'blue', ink: 'black' }),
    label: labelFor(LINK_COLORS),
  },
  align: {
    name: 'alignment',
    describe: wordFor({ left: 'left-aligned', center: 'centered' }),
    label: labelFor(HEADER_ALIGNS),
  },
  separator: {
    name: 'separator',
    describe: (value) => `separated by ${quoteSeparator(value)}`,
    describeOther: (value) => `by ${quoteSeparator(value)}`,
    label: (value) => value.trim() || 'spaces',
  },
};

const isLinkSetting = (setting: FormattingSetting) =>
  setting === 'linkStyle' || setting === 'linkColor';

const describeSubject = ({ setting, lineNumber }: FormattingChange) =>
  isLinkSetting(setting) ? 'Links' : `Header line ${lineNumber}`;

/** `otherSide` names what the page is compared with: "your draft", "v3". */
export function describeFormattingChange(
  change: FormattingChange,
  otherSide: string
): FormattingWording {
  const words = SETTING_WORDS[change.setting];
  const subject = describeSubject(change);
  const value = words.describe(change.to);
  const otherValue = `${(words.describeOther ?? words.describe)(change.from)} in ${otherSide}`;
  return {
    subject,
    value,
    otherValue,
    row: `${subject} ${value}, ${otherValue}`,
    setting: isLinkSetting(change.setting) ? words.name : `${subject} ${words.name}`,
    from: words.label(change.from),
    to: words.label(change.to),
  };
}

/**
 * The banner's trailing sentences, one per thing on the page: "Its links are underlined and
 * blue (plain and black in your draft)."
 */
export function describeFormattingDifference(
  changes: readonly FormattingChange[],
  otherSide: string
): string {
  const bySubject = new Map<string, FormattingChange[]>();
  for (const change of changes) {
    const subject = describeSubject(change);
    bySubject.set(subject, [...(bySubject.get(subject) ?? []), change]);
  }
  return [...bySubject]
    .map(([subject, group]) => {
      const describeAll = (side: 'from' | 'to') =>
        group.map((change) => SETTING_WORDS[change.setting].describe(change[side])).join(' and ');
      const verb = subject === 'Links' ? 'are' : 'is';
      return `Its ${subject.toLowerCase()} ${verb} ${describeAll('to')} (${describeAll('from')} in ${otherSide}).`;
    })
    .join(' ');
}
