/**
 * Each fictional bullet with a rewording instruction, in three proposal shapes: the whole new
 * text, find/replace pairs, and segments that must rebuild the original. One repair round on a
 * failed check, as in the app.
 *
 *   node scripts/agent-evals/runBulletEvals.ts <model…> [--think] [--limit N] [--only text,edits]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  checkEditsProposal,
  checkSegmentsProposal,
  claimsMoreThanOriginal,
  countWordDiffHunks,
  findNewNumbers,
  type ProposalCheck,
} from './checkEvalProposals.ts';
import {
  EVALS_DIR,
  loadEvalKeys,
  medianOf,
  readEvalOptions,
  writeEvalResults,
} from './evalCommandLine.ts';
import {
  pickEvalModel,
  type EvalMessage,
  type EvalTool,
  type ModelReply,
  type ToolCall,
} from './evalModelProviders.ts';

type Shape = 'segments' | 'text' | 'edits';

interface BulletEvalRow {
  shape: Shape;
  bulletId: string;
  instruction: string;
  original: string;
  outcome: string;
  attempts: number;
  ms: number;
  tokensIn: number;
  tokensOut: number;
  isFromFence: boolean;
  firstFailure?: string;
  firstArgs?: unknown;
  result?: string;
  editCount?: number;
  hunks?: number;
  newNumbers?: string[];
  claimsMore?: boolean;
  proseReply?: string;
  error?: string;
}

const INSTRUCTIONS = [
  'Tighten it. Keep the meaning.',
  'Lead with the result.',
  'Use a stronger verb than the one it opens with.',
  'Make it read as an achievement, not a duty.',
  'Trim it to fit one line of about 80 characters.',
];

const SYSTEM = `You edit resume bullets. You never invent facts, numbers, names or scope that the bullet does not contain. If a stronger bullet needs a number you do not have, write {{?}} where it would go.
Make at most three separate edits to a bullet, and leave unchanged text between any two edits, so each edit can be accepted or rejected on its own.
Always answer by calling the tool, exactly once.`;

const TOOLS: Record<Shape, EvalTool> = {
  segments: {
    name: 'propose_rewrite',
    description:
      'Propose phrase-level edits to one bullet. `segments` walks the original bullet from start to end: a keep segment copies original text unchanged; an edit segment replaces the original text `del` with `ins`. Concatenating every keep.text and edit.del, in order, must reproduce the original bullet exactly, character for character, including spaces and punctuation.',
    parameters: {
      type: 'object',
      properties: {
        bulletId: { type: 'string' },
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['keep', 'edit'] },
              text: { type: 'string', description: 'keep only: original text copied unchanged' },
              del: {
                type: 'string',
                description:
                  'edit only: original text being replaced (may be empty for a pure insertion)',
              },
              ins: {
                type: 'string',
                description: 'edit only: replacement text (may be empty for a pure deletion)',
              },
            },
            required: ['type'],
          },
        },
      },
      required: ['bulletId', 'segments'],
    },
  },
  text: {
    name: 'propose_rewrite',
    description: 'Propose a new text for one bullet. Mosaic works out the individual edits itself.',
    parameters: {
      type: 'object',
      properties: { bulletId: { type: 'string' }, text: { type: 'string' } },
      required: ['bulletId', 'text'],
    },
  },
  edits: {
    name: 'propose_rewrite',
    description:
      'Propose up to three phrase edits to one bullet. Each edit replaces `find`, a phrase copied exactly from the original bullet that appears in it only once, with `replace`. Edits must not overlap or touch each other; each one should make sense accepted on its own.',
    parameters: {
      type: 'object',
      properties: {
        bulletId: { type: 'string' },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              find: {
                type: 'string',
                description: 'Exact text from the original bullet, unique within it.',
              },
              replace: {
                type: 'string',
                description: 'Replacement text; empty to delete the phrase.',
              },
            },
            required: ['find', 'replace'],
          },
        },
      },
      required: ['bulletId', 'edits'],
    },
  },
};

/** For models that write the call as a JSON block instead of making it. */
function readFencedToolCall(text: string): ToolCall[] {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!block) return [];
  try {
    const parsed = JSON.parse(block[1]) as { name?: string; arguments?: unknown };
    return parsed.name && parsed.arguments
      ? [{ id: 'fenced', name: parsed.name, args: parsed.arguments }]
      : [{ id: 'fenced', name: 'propose_rewrite', args: parsed }];
  } catch {
    return [];
  }
}

function checkTextProposal(original: string, bulletId: string, args: unknown): ProposalCheck {
  const { bulletId: id, text } = (args ?? {}) as { bulletId?: unknown; text?: unknown };
  if (id !== bulletId || typeof text !== 'string') {
    return {
      ok: false,
      code: 'shape',
      fix: `Call it with bulletId "${bulletId}" and the new text as a string.`,
    };
  }
  if (text === original)
    return { ok: false, code: 'no-edit', fix: 'The text is unchanged; make the edit.' };
  return { ok: true, result: text, editCount: countWordDiffHunks(original, text) };
}

const CHECKS: Record<Shape, typeof checkTextProposal> = {
  segments: checkSegmentsProposal,
  text: checkTextProposal,
  edits: checkEditsProposal,
};

async function runBulletEvalsForModel(
  spec: string,
  think: boolean,
  bullets: string[],
  shapes: Shape[]
): Promise<void> {
  const { chat, label } = pickEvalModel(spec, think);
  const rows: BulletEvalRow[] = [];

  const ask = async (
    messages: EvalMessage[],
    tool: EvalTool
  ): Promise<ModelReply & { isFromFence: boolean }> => {
    const reply = await chat(SYSTEM, messages, [tool]);
    if (reply.calls.length > 0) return { ...reply, isFromFence: false };
    const fenced = readFencedToolCall(reply.text);
    return { ...reply, calls: fenced, isFromFence: fenced.length > 0 };
  };

  for (const shape of shapes) {
    for (const [index, original] of bullets.entries()) {
      const bulletId = `b${index + 1}`;
      const instruction = INSTRUCTIONS[index % INSTRUCTIONS.length];
      const messages: EvalMessage[] = [
        { role: 'user', text: `Bullet ${bulletId}: ${JSON.stringify(original)}\n\n${instruction}` },
      ];
      const row: BulletEvalRow = {
        shape,
        bulletId,
        instruction,
        original,
        outcome: 'no-call',
        attempts: 0,
        ms: 0,
        tokensIn: 0,
        tokensOut: 0,
        isFromFence: false,
      };
      try {
        for (let attempt = 1; attempt <= 2; attempt++) {
          const startedAt = performance.now();
          const reply = await ask(messages, TOOLS[shape]);
          row.attempts = attempt;
          row.ms += performance.now() - startedAt;
          row.tokensIn += reply.tokensIn ?? 0;
          row.tokensOut += reply.tokensOut ?? 0;
          row.isFromFence ||= reply.isFromFence;
          const call = reply.calls[0];
          if (!call) {
            row.outcome = 'no-call';
            row.proseReply = reply.text.slice(0, 300);
            break;
          }
          const check = CHECKS[shape](original, bulletId, call.args);
          if (check.ok) {
            row.outcome = attempt === 1 ? 'ok' : 'ok-after-repair';
            row.result = check.result;
            row.editCount = check.editCount;
            row.hunks = countWordDiffHunks(original, check.result);
            row.newNumbers = findNewNumbers(original, check.result);
            row.claimsMore = claimsMoreThanOriginal(original, check.result);
            break;
          }
          row.outcome = check.code;
          if (attempt === 1) {
            row.firstFailure = check.code;
            row.firstArgs = call.args;
          }
          messages.push({ role: 'assistant', text: reply.text, calls: [call], raw: reply.raw });
          messages.push({
            role: 'tool',
            callId: call.id,
            name: call.name,
            result: JSON.stringify({ ok: false, check: check.code, fix: check.fix }),
          });
        }
      } catch (error) {
        row.outcome = 'error';
        row.error = String(error);
      }
      rows.push(row);
      const note =
        row.firstFailure && row.outcome !== row.firstFailure ? ` (first: ${row.firstFailure})` : '';
      console.log(`${label} ${shape} ${bulletId} ${row.outcome}${note} ${Math.round(row.ms)}ms`);
    }
  }

  const suffix = shapes.length === 3 ? '' : `-${shapes.join('+')}`;
  const file = writeEvalResults(`bullets-${label}${suffix}.json`, rows);
  for (const shape of shapes) {
    const shapeRows = rows.filter((r) => r.shape === shape);
    const tally = new Map<string, number>();
    for (const r of shapeRows) tally.set(r.outcome, (tally.get(r.outcome) ?? 0) + 1);
    const counts = [...tally].map(([outcome, count]) => `${outcome} ${count}`);
    const median = medianOf(shapeRows.map((r) => r.ms)) / 1000;
    console.log(`== ${label} · ${shape}: ${counts.join(', ')} · median ${median.toFixed(1)}s`);
  }
  console.log(`rows: ${file}`);
}

loadEvalKeys();
const options = readEvalOptions(process.argv.slice(2), ['--limit', '--only']);
const allBullets = JSON.parse(
  fs.readFileSync(path.join(EVALS_DIR, 'fixtures', 'bullets.json'), 'utf8')
) as string[];
const limit = Number(options.values.get('--limit')) || allBullets.length;
const shapes = (options.values.get('--only')?.split(',') ?? [
  'segments',
  'text',
  'edits',
]) as Shape[];

await Promise.all(
  options.models.map((spec) =>
    runBulletEvalsForModel(spec, options.think, allBullets.slice(0, limit), shapes)
  )
);
