import type { HeaderItemKind } from '../../types/resume';
import { HEADER_ALIGNS, LINK_COLORS, LINK_STYLES } from '../resumeHeader';
import type { FormattingChange } from './diffFormatting';
import { getChangeTone, type Change, type ChangeTone, type EntryField } from './resumeChange';

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

const THINGS: Partial<Record<Change['line'], [string, string]>> = {
  bullet: ['bullet', 'bullets'],
  entry: ['entry', 'entries'],
  section: ['section', 'sections'],
  item: ['header item', 'header items'],
  text: ['line', 'lines'],
};

const DIFFERENT_FIELDS: Record<EntryField, [string, string]> = {
  title: ['a different role', 'different roles'],
  organization: ['a different company', 'different companies'],
  location: ['a different location', 'different locations'],
  dates: ['different dates', 'different dates'],
};

/**
 * The banner's sentence, in parts: it describes the page being read against the other side
 * ("it has 1 extra bullet … and is missing 1 entry"), never bare +1 / −1.
 */
export function describeDifference(changes: readonly Change[]): DifferenceWording {
  const counts = new Map<string, { n: number; tone: ChangeTone }>();
  const bump = (key: string, tone: ChangeTone) => {
    const count = counts.get(key) ?? { n: 0, tone };
    count.n++;
    counts.set(key, count);
  };
  for (const change of changes) {
    const tone = getChangeTone(change);
    if (change.kind === 'reorder') {
      const moved =
        change.line === 'bullet' || change.line === 'entry'
          ? change.line
          : change.line === 'summary' || change.line === 'text'
            ? 'text'
            : 'section';
      bump(`move:${moved}`, 'edit');
    } else if (change.kind === 'add' || change.kind === 'remove' || change.kind === 'toggle') {
      if (change.line === 'summary')
        bump(tone === 'add' ? 'has-summary:' : 'missing-summary:', tone);
      else bump(`${tone === 'add' ? 'extra' : 'missing'}:${change.line}`, tone);
    } else if (change.line === 'field') {
      bump(`field:${change.field}`, tone);
    } else {
      bump(`edit:${change.line}`, 'edit');
    }
  }

  const has: DifferencePhrase[] = [];
  const missing: DifferencePhrase[] = [];
  for (const [key, { n, tone }] of counts) {
    const [kind, what] = key.split(':') as [string, Change['line']];
    const [one, many] = THINGS[what] ?? [what, `${what}s`];
    let text: string | null = null;
    if (kind === 'extra') text = `${n} extra ${plural(n, one, many)}`;
    else if (kind === 'missing') missing.push({ text: `${n} ${plural(n, one, many)}`, tone });
    else if (kind === 'has-summary') text = 'a summary';
    else if (kind === 'missing-summary') missing.push({ text: 'the summary', tone });
    else if (kind === 'field') {
      const [single, several] = DIFFERENT_FIELDS[what as EntryField];
      text = `${plural(n, single, several)} on ${n} ${plural(n, 'entry', 'entries')}`;
    } else if (kind === 'move') text = `${n} ${plural(n, one, many)} in a different place`;
    else if (what === 'bullet') text = `${n} ${plural(n, 'bullet', 'bullets')} worded differently`;
    else if (what === 'text') text = `${n} ${plural(n, 'line', 'lines')} worded differently`;
    else if (what === 'summary') text = 'a reworded summary';
    else if (what === 'section') text = n === 1 ? 'a renamed section' : `${n} renamed sections`;
    else if (what === 'item') {
      text = n === 1 ? 'a different header item' : `${n} different header items`;
    } else if (what === 'name') text = 'a different name';
    if (text) has.push({ text, tone });
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

const VALUE_WORDS: Record<string, Record<string, string>> = {
  linkStyle: { underline: 'underlined', plain: 'plain' },
  linkColor: { blue: 'blue', ink: 'black' },
  align: { left: 'left-aligned', center: 'centered' },
};

const quoteSeparator = (separator: string) =>
  separator.trim() ? `“${separator.trim()}”` : 'spaces';

function nameSettingValue(setting: FormattingChange['setting'], value: string): string {
  if (setting === 'separator') return value.trim() || 'spaces';
  const options =
    setting === 'linkStyle' ? LINK_STYLES : setting === 'linkColor' ? LINK_COLORS : HEADER_ALIGNS;
  return options.find((option) => option.value === value)?.label ?? value;
}

/** `otherSide` names what the page is compared with: "your draft", "v3". */
export function describeFormattingChange(
  change: FormattingChange,
  otherSide: string
): FormattingWording {
  const { setting, lineNumber } = change;
  const isLinks = setting === 'linkStyle' || setting === 'linkColor';
  const subject = isLinks ? 'Links' : `Header line ${lineNumber}`;
  const describeValue = (value: string) =>
    setting === 'separator' ? `separated by ${quoteSeparator(value)}` : VALUE_WORDS[setting][value];
  const otherShort =
    setting === 'separator' ? `by ${quoteSeparator(change.from)}` : describeValue(change.from);
  const value = describeValue(change.to);
  const otherValue = `${otherShort} in ${otherSide}`;
  return {
    subject,
    value,
    otherValue,
    row: `${subject} ${value}, ${otherValue}`,
    setting:
      setting === 'linkStyle'
        ? 'Links'
        : setting === 'linkColor'
          ? 'Link color'
          : `Header line ${lineNumber} ${setting === 'align' ? 'alignment' : 'separator'}`,
    from: nameSettingValue(setting, change.from),
    to: nameSettingValue(setting, change.to),
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
  const groups = new Map<string, FormattingChange[]>();
  for (const change of changes) {
    const isLinks = change.setting === 'linkStyle' || change.setting === 'linkColor';
    const key = isLinks ? 'links' : `line:${change.lineNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }
  return [...groups]
    .map(([key, group]) => {
      const values = group.map((change) => describeFormattingChange(change, otherSide));
      const subject = key === 'links' ? 'links are' : `header line ${group[0].lineNumber} is`;
      const here = values.map((wording) => wording.value).join(' and ');
      const there = group
        .map((change) => describeFormattingChange({ ...change, to: change.from }, otherSide).value)
        .join(' and ');
      return `Its ${subject} ${here} (${there} in ${otherSide}).`;
    })
    .join(' ');
}
