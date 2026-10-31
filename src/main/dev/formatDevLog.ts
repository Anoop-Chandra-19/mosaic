/*
 * A line of the development log, two ways: to read in a terminal, or as JSON for whatever it
 * is piped into. Both come from the same facts, so nothing is only in one of them except
 * what the readable line leaves out to stay short, such as what every line of a run repeats.
 */

export type DevLogLevel = 'info' | 'warn' | 'error';

export type DevLogFields = Record<string, string | number | boolean | undefined>;

export interface DevLogEntry {
  at: Date;
  level: DevLogLevel;
  context: string;
  message: string;
  fields: DevLogFields;
}

/** One line of JSON. A field left undefined stays out of it. */
export const formatDevLogJson = ({ at, level, context, message, fields }: DevLogEntry): string =>
  JSON.stringify({ time: at.toISOString(), level, context, message, ...fields });

const CONTEXT_WIDTH = 7;
const COLOR: Record<'dim' | 'bold' | 'yellow' | 'red' | 'reset', string> = {
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  reset: '\u001b[0m',
};
const paint = (color: keyof typeof COLOR, text: string) => `${COLOR[color]}${text}${COLOR.reset}`;

/** "12ms", or "3.4s" from a second up. */
export const formatDuration = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;

const RUN_NAME_FIELDS = ['conversation', 'run', 'runId', 'provider', 'model'];
const RUN_NAME_MESSAGES = new Set(['run started', 'run ended']);
/** Shown another way (the time beside the message), or of use only to a tool reading the JSON. */
const NEVER_LISTED = new Set(['durationMs', 'channel', 'callId']);

function listFacts({ context, message, fields }: DevLogEntry): string {
  const hidesRunName = context === 'run' && !RUN_NAME_MESSAGES.has(message);
  return Object.entries(fields)
    .filter(([name, value]) => {
      if (value === undefined || NEVER_LISTED.has(name)) return false;
      if (name === 'outcome' && value === 'ok') return false;
      return !(hidesRunName && RUN_NAME_FIELDS.includes(name));
    })
    .map(([name, value]) => `${name}=${value}`)
    .join(' ');
}

/** A bridge call goes by its channel; a warning, whose long text is rarely news, by its first line. */
function readTitle({ level, context, message, fields }: DevLogEntry): string {
  if (context === 'bridge' && typeof fields.channel === 'string') {
    return level === 'info' ? fields.channel : `${fields.channel} ${message}`;
  }
  return level === 'warn' ? message.split('\n')[0] : message;
}

/** Problems stand out, a run's start and end mark it off, and ordinary bridge calls step back. */
function paintTitle({ level, context, message }: DevLogEntry, title: string): string {
  if (level === 'error') return paint('red', title);
  if (level === 'warn') return paint('yellow', title);
  if (context === 'bridge') return paint('dim', title);
  return context === 'run' && RUN_NAME_MESSAGES.has(message) ? paint('bold', title) : title;
}

/** "20:14:25.354  run        tool finished 7ms  tool=read_document", local time, for reading. */
export function formatDevLogForReading(entry: DevLogEntry): string {
  const { at, context, message, fields } = entry;
  const stamp = `${at.toTimeString().slice(0, 8)}.${String(at.getMilliseconds()).padStart(3, '0')}`;
  const indent = context === 'run' && !RUN_NAME_MESSAGES.has(message) ? '  ' : '';
  const took = typeof fields.durationMs === 'number' ? ` ${formatDuration(fields.durationMs)}` : '';
  const facts = listFacts(entry);
  const title = paintTitle(entry, `${indent}${readTitle(entry)}${took}`);
  const line = `${paint('dim', stamp)}  ${context.padEnd(CONTEXT_WIDTH)}  ${title}`;
  return facts ? `${line}  ${paint('dim', facts)}` : line;
}
