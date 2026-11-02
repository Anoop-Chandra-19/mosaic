import { answer, refuse, type ToolAnswer } from '../tool-run/agentToolRun';

/*
 * Format propose-call diagnostics as one line each. Put interpretation notes first,
 * then target-prefixed results ("b3: suggested."). Return an error only when no result
 * is successful or informational, such as an already-satisfied change.
 */

export type DiagnosticKind = 'took' | 'ok' | 'info' | 'error';

export interface Diagnostic {
  kind: DiagnosticKind;
  /** The handle or words the line is about ("b3", "a new entry in s1"), or none. */
  target: string | null;
  text: string;
}

export const diagnose = (
  kind: DiagnosticKind,
  target: string | null,
  text: string
): Diagnostic => ({
  kind,
  target,
  text,
});

const formatLine = ({ target, text }: Diagnostic) => (target ? `${target}: ${text}` : text);

export function formatToolAnswer(diagnostics: Diagnostic[]): ToolAnswer {
  const took = diagnostics.filter((each) => each.kind === 'took');
  const rest = diagnostics.filter((each) => each.kind !== 'took');
  const content = [...took, ...rest].map(formatLine).join('\n');
  const isDone = rest.some((each) => each.kind === 'ok' || each.kind === 'info');
  return isDone ? answer(content) : refuse(content);
}
