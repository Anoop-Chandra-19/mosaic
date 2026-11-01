/**
 * Instructions that name the words to change ("Swap Led for Drove"), against the one right
 * result. Each case runs with only `propose_rewrite`, and with the app's pair: rewrite for one
 * bullet, `propose_replace_everywhere` for a term across them. The pair should pick rewrite
 * for one bullet and replace only for the `everywhere` cases.
 *
 *   node scripts/agent-evals/runTargetedEvals.ts <model…> [--think] [--literal]
 *
 * `--literal` uses the rewrite wording from before the grammar rule, which models obeyed to the
 * letter ("Led in the planning").
 */
import { PROPOSE_TOOLS } from '../../src/shared/agent-tools/proposeTools.ts';
import { replaceEveryWholeWord } from '../../src/renderer/src/features/agent/tools/propose/replaceEveryWholeWord.ts';
import type { ModelTool } from '../../src/shared/types/modelTool.ts';
import { loadEvalKeys, readEvalOptions, writeEvalResults } from './evalCommandLine.ts';
import { pickEvalModel, type EvalMessage, type EvalTool } from './evalModelProviders.ts';
import { TARGETED_CASES } from './fixtures/targetedCases.ts';

type ToolMode = 'rewrite' | 'both';

interface TargetedEvalRow {
  caseNumber: number;
  kind: string;
  mode: ToolMode;
  isExact: boolean;
  results: string[];
  tools: string[];
  repairs: number;
  looseMatches: number;
  notes: string[];
}

const SYSTEM = `You edit resume bullets. You never invent facts, numbers, names or scope.
Always answer by calling a tool, and never for a bullet you leave alone.`;

const toEvalTool = ({ name, description, inputSchema }: ModelTool): EvalTool => ({
  name,
  description,
  parameters: inputSchema,
});

/** The app's own rewrite tool, or with `--literal` the wording from before the grammar rule. */
function describeRewriteTool(isLiteral: boolean): EvalTool {
  const tool = toEvalTool(PROPOSE_TOOLS.propose_rewrite);
  return isLiteral
    ? {
        ...tool,
        description:
          'Propose a new text for one bullet. Change only what the request needs; keep every other word as it is.',
      }
    : tool;
}

const REPLACE_EVERYWHERE_TOOL = toEvalTool(PROPOSE_TOOLS.propose_replace_everywhere);

const normalizeBullet = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/\.$/, '');

/**
 * propose_replace_everywhere as the app runs it: every whole-word use in every bullet
 * changes, and none anywhere is the problem.
 */
function replaceEverywhere(current: string[], find: string, replace: string) {
  let looseMatches = 0;
  let changedCount = 0;
  current.forEach((text, i) => {
    const replaced = replaceEveryWholeWord(text, find, replace);
    if (!replaced) return;
    if (replaced.isLoose) looseMatches++;
    changedCount++;
    current[i] = replaced.text.replace(/ {2,}/g, ' ').trim();
  });
  const problem = changedCount
    ? null
    : `"${find}" is in no bullet. Copy find exactly as the bullets write it.`;
  return { problem, looseMatches };
}

async function runTargetedEvalsForModel(spec: string, think: boolean, isLiteral: boolean) {
  const { chat, label } = pickEvalModel(spec, think);
  const rewriteTool = describeRewriteTool(isLiteral);
  const rows: TargetedEvalRow[] = [];
  const toolsByMode: Record<ToolMode, EvalTool[]> = {
    rewrite: [rewriteTool],
    both: [rewriteTool, REPLACE_EVERYWHERE_TOOL],
  };

  for (const mode of ['rewrite', 'both'] as const) {
    const tools = toolsByMode[mode];
    const system = SYSTEM;

    for (const [index, testCase] of TARGETED_CASES.entries()) {
      const current = [...testCase.bullets];
      const ids = current.map((_, i) => `b${i + 1}`);
      const document = current
        .map((text, i) => `Bullet ${ids[i]}: ${JSON.stringify(text)}`)
        .join('\n');
      const messages: EvalMessage[] = [
        { role: 'user', text: `${document}\n\n${testCase.instruction}` },
      ];
      const row: TargetedEvalRow = {
        caseNumber: index + 1,
        kind: testCase.kind,
        mode,
        isExact: false,
        results: [],
        tools: [],
        repairs: 0,
        looseMatches: 0,
        notes: [],
      };

      for (let turn = 0; turn < 5; turn++) {
        let reply;
        try {
          reply = await chat(system, messages, tools);
        } catch (error) {
          row.notes.push(`error: ${error}`);
          break;
        }
        if (reply.calls.length === 0) break;
        messages.push({ role: 'assistant', text: reply.text, calls: reply.calls, raw: reply.raw });

        for (const call of reply.calls) {
          row.tools.push(call.name);
          const args = (call.args ?? {}) as {
            id?: string;
            text?: unknown;
            find?: unknown;
            replace?: unknown;
          };
          let problem: string | null = null;

          if (call.name === 'propose_rewrite') {
            const i = ids.indexOf(args.id ?? '');
            if (i === -1 || typeof args.text !== 'string') {
              problem = `id must be one of ${ids.join(', ')} and text a string.`;
            } else {
              current[i] = args.text;
            }
          } else if (typeof args.find !== 'string' || typeof args.replace !== 'string') {
            problem = 'find and replace must both be strings.';
          } else {
            const replaced = replaceEverywhere(current, args.find, args.replace);
            problem = replaced.problem;
            row.looseMatches += replaced.looseMatches;
          }

          if (problem) row.repairs++;
          messages.push({
            role: 'tool',
            callId: call.id,
            name: call.name,
            result: JSON.stringify(problem ? { ok: false, fix: problem } : { ok: true }),
          });
        }
      }

      row.results = current;
      row.isExact = current.every(
        (text, i) => normalizeBullet(text) === normalizeBullet(testCase.expected[i])
      );
      current.forEach((text, i) => {
        if (normalizeBullet(text) !== normalizeBullet(testCase.expected[i]))
          row.notes.push(`${ids[i]}: ${JSON.stringify(text)}`);
      });
      rows.push(row);
      console.log(
        `${label} ${mode} #${row.caseNumber} ${testCase.kind} ${row.isExact ? 'exact' : 'DIFF'} ${row.tools.join(',')}`
      );
      for (const note of row.notes) console.log(`    ${note}`);
    }
  }

  const file = writeEvalResults(`targeted-${label}${isLiteral ? '-literal' : ''}.json`, rows);
  for (const mode of ['rewrite', 'both']) {
    const modeRows = rows.filter((r) => r.mode === mode);
    console.log(
      `== ${label} · ${mode}: exact ${modeRows.filter((r) => r.isExact).length}/${modeRows.length}`
    );
  }
  console.log(`rows: ${file}`);
}

loadEvalKeys();
const options = readEvalOptions(process.argv.slice(2), []);
await Promise.all(
  options.models.map((spec) =>
    runTargetedEvalsForModel(spec, options.think, options.flags.has('--literal'))
  )
);
