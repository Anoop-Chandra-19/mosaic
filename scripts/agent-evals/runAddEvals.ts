/**
 * Requests that add bullets, lines, entries and sections, move things, or reach lines,
 * entries and sections, with every propose tool offered. Each case runs once per shape of
 * the tools (`addEvalTools.ts`) and style of answer (`runAddEvalTool.ts`), and is scored on
 * the resume the calls leave, as if every suggestion were kept: what changed or was added,
 * where, holding which words, and nothing else. A run that stops with a new section still
 * empty is told so, as the app will, twice at most. A call made again word for word is
 * counted as a repeat.
 *
 * Two case sets: `main`, which the manifest is tuned against, and `held-out`, which it never
 * is (`fixtures/addHeldOutCases.ts`). Each is summed apart.
 *
 *   node scripts/agent-evals/runAddEvals.ts <model…> [--think] [--only builder]
 *     [--answers short,echo,list] [--repeat 2]
 *   node scripts/agent-evals/runAddEvals.ts --dry
 *
 * `--dry` needs no model: it plays each case's own right answer in every shape and answer
 * style, which checks the cases, the simulated tools and the scoring against each other.
 */
import { checkAgentToolArgs } from '../../src/renderer/src/features/agent/tools/checkAgentToolArgs.ts';
import { readAgentToolArgs } from '../../src/renderer/src/features/agent/tools/readAgentToolArgs.ts';
import { formatEvalResume, type EvalResume } from './addEvalResume.ts';
import {
  ADD_EVAL_SHAPES,
  ADD_EVAL_TOOL_SETS,
  describeAddEvalTools,
  type AddEvalShape,
} from './addEvalTools.ts';
import { loadEvalKeys, readEvalOptions, writeEvalResults } from './evalCommandLine.ts';
import {
  pickEvalModel,
  type ChatWithModel,
  type EvalMessage,
  type EvalTool,
} from './evalModelProviders.ts';
import {
  ADD_CASES,
  startingAddResume,
  type AddCase,
  type AddEvalCall,
} from './fixtures/addCases.ts';
import { HELD_OUT_CASES, startingHeldOutResume } from './fixtures/addHeldOutCases.ts';
import {
  listEmptyNewSections,
  lookUpEvalResume,
  runAddEvalTool,
  type AddEvalToolAnswer,
  type AnswerStyle,
} from './runAddEvalTool.ts';
import {
  describeAddEvalChanges,
  listAddEvalChanges,
  matchesAddOutcome,
} from './scoreAddEvalCase.ts';

type CaseSetName = 'main' | 'held-out';

interface CaseSet {
  name: CaseSetName;
  cases: AddCase[];
  startingResume: () => EvalResume;
}

const CASE_SETS: CaseSet[] = [
  { name: 'main', cases: ADD_CASES, startingResume: startingAddResume },
  { name: 'held-out', cases: HELD_OUT_CASES, startingResume: startingHeldOutResume },
];

const ANSWER_STYLES: AnswerStyle[] = ['short', 'echo', 'list'];

/** One way of offering the tools: their shape, and how they answer. */
interface Variant {
  shape: AddEvalShape;
  answers: AnswerStyle;
}

interface AddEvalRow extends Variant {
  set: CaseSetName;
  caseNumber: number;
  attempt: number;
  isRight: boolean;
  calls: string[];
  refusals: number;
  /** What each refused call was told, for counting refusals by kind. */
  refusedWith: string[];
  /** Arguments read another way, their one reading. */
  took: number;
  /** Calls made again with the same arguments, text included. */
  repeats: number;
  notes: string[];
}

const SYSTEM = `You edit a resume. You never invent facts, numbers, names or scope.
Always answer by calling tools, and never touch text the user didn't ask about.`;

const MAX_STEPS = 8;
const MAX_EMPTY_SECTION_NOTES = 2;

const asArgs = (args: unknown) =>
  (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>;

interface CallResult extends AddEvalToolAnswer {
  /** How many arguments were read another way, their one reading. */
  tookCount: number;
}

/**
 * A call as the variant's app would run it. The builder's arguments are read the one way
 * they can be, then checked against the schema; what was taken goes first in the answer.
 */
function runCall(
  resume: EvalResume,
  variant: Variant,
  tools: EvalTool[],
  name: string,
  args: Record<string, unknown>
): CallResult {
  const toolSet = ADD_EVAL_TOOL_SETS[variant.shape];
  const settings = { ...toolSet, answers: variant.answers };
  const evalTool = tools.find((each) => each.name === name);
  if (!evalTool) return { ...runAddEvalTool(resume, settings, name, args), tookCount: 0 };
  const tool = { ...evalTool, inputSchema: evalTool.parameters };
  const read = readAgentToolArgs(tool, args, lookUpEvalResume(resume));
  const checked = checkAgentToolArgs(tool, read.args);
  const answer =
    'problem' in checked
      ? { answer: checked.problem, isRefused: true }
      : runAddEvalTool(resume, settings, name, checked.args);
  const took = read.took.length ? `${read.took.join(' ')}\n` : '';
  return { ...answer, answer: `${took}${answer.answer}`, tookCount: read.took.length };
}

function describeCall(name: string, args: Record<string, unknown>, isRefused: boolean): string {
  const shownArgs = Object.entries(args)
    .filter(([key]) => !['text', 'reason', 'bullets', 'lines', 'withoutNumber'].includes(key))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  return `${name}(${shownArgs.join(' ')})${isRefused ? '!' : ''}`;
}

function scoreCase(caseSet: CaseSet, testCase: AddCase, resume: EvalResume, row: AddEvalRow) {
  const changes = listAddEvalChanges(caseSet.startingResume(), resume);
  const hasUnscored = row.notes.some((note) => note.startsWith('unscored'));
  row.isRight =
    !hasUnscored && testCase.outcomes.some((outcome) => matchesAddOutcome(changes, outcome));
  if (!row.isRight) row.notes.push(...describeAddEvalChanges(changes));
}

function newRow(set: CaseSetName, caseNumber: number, variant: Variant, attempt: number) {
  const row: AddEvalRow = {
    ...variant,
    set,
    caseNumber,
    attempt,
    isRight: false,
    calls: [],
    refusals: 0,
    refusedWith: [],
    took: 0,
    repeats: 0,
    notes: [],
  };
  return row;
}

const describeVariant = ({ shape, answers }: Variant) => `${shape}/${answers}`;

const printRow = (label: string, row: AddEvalRow) => {
  const verdict = row.isRight ? 'right' : 'WRONG';
  console.log(
    `${label} ${describeVariant(row)} ${row.set} #${row.caseNumber} ${verdict} ${row.calls.join(', ')}`
  );
  for (const note of row.notes) console.log(`    ${note}`);
};

function listVariants(shapes: AddEvalShape[], answers: AnswerStyle[]): Variant[] {
  return shapes.flatMap((shape) => answers.map((style) => ({ shape, answers: style })));
}

function runDry(): boolean {
  let isAllRight = true;
  for (const variant of listVariants(ADD_EVAL_SHAPES, ANSWER_STYLES)) {
    const tools = describeAddEvalTools(variant.shape);
    for (const caseSet of CASE_SETS) {
      for (const [index, testCase] of caseSet.cases.entries()) {
        const resume = caseSet.startingResume();
        const row = newRow(caseSet.name, index + 1, variant, 1);
        const calls = pickAnswer(testCase, variant);
        for (const { name, args } of calls) {
          const answer = runCall(resume, variant, tools, name, args);
          row.calls.push(describeCall(name, args, answer.isRefused));
          if (answer.isRefused) row.notes.push(answer.answer);
        }
        scoreCase(caseSet, testCase, resume, row);
        if (row.isRight) continue;
        isAllRight = false;
        printRow('dry', row);
      }
    }
  }
  console.log(isAllRight ? 'Every answer scores right.' : 'Some answers score wrong.');
  return isAllRight;
}

/** The app's note when the model stops with a new section still empty, if one is. */
function noteEmptySections(caseSet: CaseSet, resume: EvalResume) {
  const empty = listEmptyNewSections(caseSet.startingResume(), resume);
  if (empty.length === 0) return null;
  const handles = empty.map((section) => section.handle).join(', ');
  return `The run can't finish yet: ${handles} is still empty. Add its first entry with propose_entry, or its lines with propose_add.`;
}

/** The case's right answer in the variant's tools, for `--dry`. */
function pickAnswer(testCase: AddCase, variant: Variant): AddEvalCall[] {
  const { isBuilder } = ADD_EVAL_TOOL_SETS[variant.shape];
  return (isBuilder && testCase.builderAnswer) || testCase.answer;
}

async function runCase(
  chat: ChatWithModel,
  variant: Variant,
  caseSet: CaseSet,
  index: number,
  attempt: number
): Promise<AddEvalRow> {
  const testCase = caseSet.cases[index];
  const tools = describeAddEvalTools(variant.shape);
  const resume = caseSet.startingResume();
  const row = newRow(caseSet.name, index + 1, variant, attempt);
  const messages: EvalMessage[] = [
    { role: 'user', text: `${formatEvalResume(resume)}\n\n${testCase.instruction}` },
  ];
  const callsMade = new Set<string>();
  let emptySectionNotes = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    let reply;
    try {
      reply = await chat(SYSTEM, messages, tools);
    } catch (error) {
      row.notes.push(`error: ${error}`);
      return row;
    }
    if (reply.calls.length === 0) {
      const note = noteEmptySections(caseSet, resume);
      if (!note || emptySectionNotes >= MAX_EMPTY_SECTION_NOTES) break;
      emptySectionNotes++;
      row.notes.push('told: a new section is still empty');
      messages.push({ role: 'assistant', text: reply.text, calls: [], raw: reply.raw });
      messages.push({ role: 'user', text: note });
      continue;
    }
    messages.push({ role: 'assistant', text: reply.text, calls: reply.calls, raw: reply.raw });
    for (const call of reply.calls) {
      const args = asArgs(call.args);
      const callKey = JSON.stringify([call.name, args]);
      if (callsMade.has(callKey)) row.repeats++;
      callsMade.add(callKey);
      const answer = runCall(resume, variant, tools, call.name, args);
      row.calls.push(describeCall(call.name, args, answer.isRefused));
      row.took += answer.tookCount;
      if (answer.isRefused) {
        row.refusals++;
        row.refusedWith.push(answer.answer);
      }
      if (answer.isUnscored) row.notes.push(`unscored: ${call.name}`);
      messages.push({ role: 'tool', callId: call.id, name: call.name, result: answer.answer });
    }
  }
  scoreCase(caseSet, testCase, resume, row);
  return row;
}

function summarize(label: string, rows: AddEvalRow[], variant: Variant, set: CaseSetName) {
  const setRows = rows.filter(
    (row) => row.shape === variant.shape && row.answers === variant.answers && row.set === set
  );
  const wrong = setRows.filter((row) => !row.isRight).map((row) => `#${row.caseNumber}`);
  const refusals = setRows.reduce((sum, row) => sum + row.refusals, 0);
  const repeats = setRows.reduce((sum, row) => sum + row.repeats, 0);
  const right = setRows.length - wrong.length;
  const misses = wrong.length ? ` (${wrong.join(' ')})` : '';
  console.log(
    `== ${label} · ${describeVariant(variant)} · ${set}: ${right}/${setRows.length}${misses} · refused ${refusals} · repeats ${repeats}`
  );
}

async function runAddEvalsForModel(
  spec: string,
  think: boolean,
  variants: Variant[],
  repeat: number
) {
  const { chat, label } = pickEvalModel(spec, think);
  const rows: AddEvalRow[] = [];
  for (let attempt = 1; attempt <= repeat; attempt++) {
    for (const variant of variants) {
      for (const caseSet of CASE_SETS) {
        for (const index of caseSet.cases.keys()) {
          const row = await runCase(chat, variant, caseSet, index, attempt);
          rows.push(row);
          printRow(label, row);
        }
      }
    }
  }

  const file = writeEvalResults(`add-${label}.json`, rows);
  for (const variant of variants) {
    for (const caseSet of CASE_SETS) summarize(label, rows, variant, caseSet.name);
  }
  console.log(`rows: ${file}`);
}

/** A comma list of names from `known`, or all of them when the flag is left out. */
function readNames<T extends string>(flag: string, value: string | undefined, known: T[]): T[] {
  if (!value) return known;
  const names = value.split(',').map((name) => name.trim());
  const unknown = names.filter((name) => !known.includes(name as T));
  if (unknown.length) {
    throw new Error(`${flag}: unknown ${unknown.join(', ')}; use ${known.join(', ')}`);
  }
  return names as T[];
}

const argv = process.argv.slice(2);
if (argv.includes('--dry')) {
  process.exitCode = runDry() ? 0 : 1;
} else {
  loadEvalKeys();
  const options = readEvalOptions(argv, ['--only', '--answers', '--repeat']);
  const shapes = readNames('--only', options.values.get('--only'), ADD_EVAL_SHAPES);
  const answers = readNames('--answers', options.values.get('--answers') ?? 'short', ANSWER_STYLES);
  const repeat = Number(options.values.get('--repeat') ?? 1) || 1;
  await Promise.all(
    options.models.map((spec) =>
      runAddEvalsForModel(spec, options.think, listVariants(shapes, answers), repeat)
    )
  );
}
