/**
 * Instructions that name the words to change ("Swap Led for Drove"), against the one right
 * result. Each case runs with only `propose_rewrite`, only `propose_replace`, and both.
 *
 *   node scripts/agent-evals/runTargetedEvals.ts <model…> [--think] [--literal]
 *
 * `--literal` uses the rewrite wording from before the grammar rule, which models obeyed to the
 * letter ("Led in the planning").
 */
import { locatePhrase } from './checkEvalProposals.ts';
import { loadEvalKeys, readEvalOptions, writeEvalResults } from './evalCommandLine.ts';
import { pickEvalModel, type EvalMessage, type EvalTool } from './evalModelProviders.ts';
import { TARGETED_CASES } from './fixtures/targetedCases.ts';

type ToolMode = 'rewrite' | 'replace' | 'both';

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
Always answer by calling a tool; call it once per bullet you change, and never for a bullet you leave alone.`;
const CHOOSE_TOOL = `\nWhen the user names the words to change, use propose_replace. When they describe a quality they want ("stronger", "tighter"), use propose_rewrite.`;

const GRAMMAR_RULE =
  'Change only what the request needs, but the result must still read as a correct sentence: when a swapped word needs its neighbours to change (swapping "Assisted" for "Led" in "Assisted in the planning" gives "Led the planning"), change them too.';

function describeRewriteTool(isLiteral: boolean): EvalTool {
  return {
    name: 'propose_rewrite',
    description: `Propose a new text for one bullet. ${isLiteral ? 'Change only what the request needs; keep every other word as it is.' : GRAMMAR_RULE}`,
    parameters: {
      type: 'object',
      properties: { bulletId: { type: 'string' }, text: { type: 'string' } },
      required: ['bulletId', 'text'],
    },
  };
}

const REPLACE_TOOL: EvalTool = {
  name: 'propose_replace',
  description:
    'Replace exact text. `find` is copied exactly from the bullet and must appear in it once; include any neighbouring words that must also change for the sentence to still read (to swap "Assisted" for "Led" in "Assisted in the planning", find "Assisted in" and replace with "Led"). Leave out bulletId to apply to every bullet that contains `find`.',
  parameters: {
    type: 'object',
    properties: {
      bulletId: { type: 'string', description: 'Omit to replace in every bullet containing find.' },
      find: { type: 'string' },
      replace: { type: 'string' },
    },
    required: ['find', 'replace'],
  },
};

const normalizeBullet = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/\.$/, '');

async function runTargetedEvalsForModel(spec: string, think: boolean, isLiteral: boolean) {
  const { chat, label } = pickEvalModel(spec, think);
  const rewriteTool = describeRewriteTool(isLiteral);
  const rows: TargetedEvalRow[] = [];

  for (const mode of ['rewrite', 'replace', 'both'] as const) {
    const tools =
      mode === 'rewrite'
        ? [rewriteTool]
        : mode === 'replace'
          ? [REPLACE_TOOL]
          : [rewriteTool, REPLACE_TOOL];
    const system = SYSTEM + (mode === 'both' ? CHOOSE_TOOL : '');

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
            bulletId?: string;
            text?: unknown;
            find?: unknown;
            replace?: unknown;
          };
          let problem: string | null = null;

          if (call.name === 'propose_rewrite') {
            const i = ids.indexOf(args.bulletId ?? '');
            if (i === -1 || typeof args.text !== 'string') {
              problem = `bulletId must be one of ${ids.join(', ')} and text a string.`;
            } else {
              current[i] = args.text;
            }
          } else if (typeof args.find !== 'string' || typeof args.replace !== 'string') {
            problem = 'find and replace must both be strings.';
          } else {
            const { find, replace } = args;
            const targets = args.bulletId
              ? [ids.indexOf(args.bulletId)]
              : ids.map((_, i) => i).filter((i) => locatePhrase(current[i], find) !== 'none');
            if (targets.length === 0 || targets.includes(-1)) {
              problem = args.bulletId
                ? `bulletId must be one of ${ids.join(', ')}.`
                : `${JSON.stringify(find)} is in no bullet.`;
            }
            for (const i of targets.filter((i) => i >= 0)) {
              const at = locatePhrase(current[i], find);
              if (at === 'none') {
                problem = `${JSON.stringify(find)} is not in ${ids[i]}: ${JSON.stringify(current[i])}. Copy find exactly.`;
              } else if (at === 'many') {
                problem = `${JSON.stringify(find)} appears more than once in ${ids[i]}; include more surrounding words.`;
              } else {
                if (at.isLoose) row.looseMatches++;
                current[i] = (current[i].slice(0, at.start) + replace + current[i].slice(at.end))
                  .replace(/ {2,}/g, ' ')
                  .trim();
              }
            }
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
  for (const mode of ['rewrite', 'replace', 'both']) {
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
