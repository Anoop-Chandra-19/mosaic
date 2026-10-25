import { answer, refuse, type ToolAnswer } from '../agentToolRun';

/*
 * What a propose call says back, as a compiler's diagnostics: one line each, what was
 * taken first, then a line for each target, the target first ("b3: suggested."). A call
 * is an error only when nothing in it was suggested or found already so.
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
