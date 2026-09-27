# Agent evals

How models handle the assistant's edit tools, measured against fictional bullets. Run by hand
when a prompt, a tool description, or a provider adapter changes; compare the tables before
and after. Never in CI, and never with a real person's resume.

## Keys

Put the keys you have in `scripts/agent-evals/.env` (gitignored):

```
OPENAI_API_KEY=…
ANTHROPIC_API_KEY=…
GOOGLE_API_KEY=…
OPENROUTER_API_KEY=…
```

Ollama needs no key (`OLLAMA_URL` if it is not on this computer). An OpenAI-compatible
server (LM Studio, llama.cpp, vLLM) is `COMPATIBLE_URL` and, if it wants one, `COMPATIBLE_KEY`.

## Runs

A model is `provider[:model]`: `ollama`, `openai:gpt-6-luna`, `anthropic`, `gemini`,
`openrouter:qwen/qwen3.8-27b`, `compatible:<model>`. Several models run in parallel.

```sh
# 50 bullets, each reworded in three proposal shapes, one repair round on a failed check
node scripts/agent-evals/runBulletEvals.ts ollama openai:gpt-6-luna [--think] [--limit 10] [--only text,edits]

# 20 instructions that name the words to change, with rewrite only, replace only, and both
node scripts/agent-evals/runTargetedEvals.ts anthropic gemini [--think] [--literal]

# Tables from everything in results/
node scripts/agent-evals/summarizeEvalResults.ts
```

Each run writes its rows to `results/` (gitignored). A full run of both evals is about 220
short calls per model; thinking multiplies the time and output tokens several times over.

## What is measured

- **Bullet evals** (`fixtures/bullets.json`): does the proposal pass its checks on the first
  try or after one repair, how many separate changes it makes, and whether it claims more
  than the original ("Assisted" → "Led") or adds a number the bullet did not have.
- **Targeted evals** (`fixtures/targetedCases.ts`): whether the bullet ends up exactly as
  asked, including swaps that need a neighbouring word changed ("Assisted in the planning"
  → "Led the planning").
