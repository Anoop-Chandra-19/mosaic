# Development

Details for working on Mosaic: development data, the React Compiler, and end-to-end tests.
Setup and scripts are in the [README](../README.md).

## Code navigation and architecture checks

These are development tools only: neither is imported by the app, required by its build,
run automatically by Git hooks, or connected to Graphify Cloud.

### Dependency checks

```bash
bun run check:deps
```

[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) is an npm dev dependency.
`.dependency-cruiser.cjs` checks all source TS/TSX files, including tests and type-only
imports, for cycles and unresolved imports. It also checks process boundaries, reverse
renderer-layer imports, and that only main's `model-providers/` imports a provider SDK or
Node's HTTP modules. Tests are exempt from layer restrictions, not cycle detection.
Resolution follows the TypeScript aliases and Vite's exact `cn` alias; `import.meta.glob`
is not expanded. It is an import-graph check, not a runtime behavior or DOM-usage audit.

The command exits nonzero on violations. There is no suppression baseline; keep findings
visible and fix them in a focused change rather than reorganizing application code as part
of tooling setup.

### Local Graphify graph

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) separately, then run:

```bash
bun run graph:build
bun run graph query "flushDraft scheduleSave"
bun run graph explain "flushDraft"
bun run graph path "scheduleSave" "flushDraft"
```

Use the same scripts with `npm run`; npm needs `--` before forwarded arguments, for example
`npm run graph -- explain "flushDraft"`. Ambiguous symbol names return candidates: use the
qualified name or identifier reported by the tool rather than guessing which match it meant.

`scripts/graphify.ts` runs the pinned `graphifyy` CLI with its SQL parser extra through
`uv tool run`, in an isolated cached Python environment rather than a global install. The first run downloads the tool
and its dependencies (and a compatible Python if needed); normal app setup needs neither
uv nor Python. The wrapper disables model backends (`GRAPHIFY_BACKEND=none`) and local
query logging, and `graph:build` requests code-only extraction. No model key is needed;
source extraction does not use a remote semantic backend. Do not override these settings
or enable document/media extraction without reviewing the privacy implications.

`.graphifyignore` excludes local profiles, environment files, personal documents, docs,
lockfiles, dependency folders, build output, and planning material. Source, code tests,
scripts, and code/config relationships remain available. Keep private files excluded even
when using local extraction. Generated `graphify-out/` files are local and gitignored;
commit the setup, not the generated graph. To create an interactive browser map:

```bash
bun run graph export html
```

Use scoped `query`, `explain`, and `path` results for broad navigation or impact questions,
then read the relevant source before changing it. Code-only queries retrieve matching symbol
neighborhoods, not model-written answers; include known symbol names to reduce irrelevant
matches. Some files yield no symbols, and dynamic calls or IPC need source inspection. Zustand store
actions are not symbols either: explain the store (`useOverlayStore`) to find who uses it,
then search for the action (`openSurface(`). Do not load the full `graph.json` into
agent context. Re-run `graph:build` after source changes, pulls, or branch switches; review
any extraction warnings before trusting results. A missing edge is not proof of no
relationship, and Graphify does not replace dependency-cruiser, tests, or targeted search.
If the optional tool is unavailable, proceed with normal search. Assistant integrations
live in the canonical `CLAUDE.md`; do not run `graphify install` over the `AGENTS.md` symlinks
or install automatic search/Git hooks.

## Development data

Development runs keep their data in the repo's gitignored `.dev-data/`, never an installed
Mosaic's profile. Quit the app before `bun run dev:reset`, which deletes that data and the
API keys dev runs saved in the keychain (the `Mosaic (dev)` service, never an installed
Mosaic's).

## Developer tools

Every build except a release has the developer tools: a palette opened with Ctrl+Shift+D
(⇧⌘D on a Mac) from any screen, Develop › Developer tools… in the menu bar, or the wrench in
the top bar's empty space. The window's title says `Mosaic DEV`. The tools check the app with
fictional data, such as opening an example resume or staging the assistant's suggestions
without a provider, and go to any view: a tool's choices (which template, which version) are
made one step at a time, and Ctrl+Enter takes the defaults. Recent (kept in
`.dev-data/dev-tools.json`) runs the last one again with Enter. Each tool is one entry in
`DEV_TOOLS` (`features/dev-tools/tools/runDevTool.ts`).

Replace all data with a profile swaps the development data for a generated set, the same
every time: Fresh (erased, as on first run, keys included, as `dev:reset` does), Everyday
(3 templates, about 40 versions each), Heavy (12 templates, 600 versions on one holding
the 210-bullet resume the speed check pastes; the memory check runs on it) or Worst case
(50 templates of that resume, 3,000 versions on one; the speed check runs on it). It asks
first, and only Ctrl+Enter goes ahead. Worst case is written in parts, so a failure partway
leaves the parts written; the others are written in one go. Restore a backup file opens Settings' Restore a backup on a file you pick.

The memory check lists what each process holds (Main, Window, GPU, utilities) as Electron
reports it, with the change since the last check and Copy as text. Switches stay on across
launches until turned off, named in the window's title, with a dot on the wrench: Slow
motion (every animation 10 times slower) and Reduced motion, which main applies through the
window's debugger; Outline measured boxes, the boxes pagination measures on the page;
Reopen this view at launch, which goes back to the view each launch closed on; and Scripted
model, which runs the assistant on a script in main (`src/main/dev/scriptedModelProvider.ts`)
in place of the chosen provider: it reads the resume, suggests two changes and finishes. The
switches and Recent are kept in `.dev-data/dev-tools.json`. A spec turns one on with
`runDevTool(page, 'slowMotion', { isOn: true })`.

Ask the assistant… (Data) starts a run on the open resume with the text you type, turning
the assistant on, and its suggestions come in for review; a toast says how the run ended.
It carries on the conversation the palette last asked in, until the window reloads; Ask in
a new conversation… starts afresh. They stand in for the assistant's pane until the pane is
built.

Every view has an address, such as `history / Tailored for Kestrel / v12 vs v11 / changes`
(`features/view-address/`). The palette shows where you are with Copy (Ctrl+Shift+C), and a
pasted address goes there. Release builds have Help › Copy view address too, so a bug report
can say where it happened.

e2e runs the same tools for setup (`e2e/harness/devTools.ts`): `runDevTool`, `goToView` by
address and `expectViewAt`, so a spec clicks only what it tests. `makeHistory` adds a
template with the versions a spec lists (named or not, and the name on the resume), in
place of naming them one by one in the editor. A setup a spec needs that no tool makes
becomes a tool first.

`bun run package` builds with `--mode release`, which leaves the tools out of the
installer. `electron.vite.config.ts` declares `features/dev-tools/` free of side effects, so
release drops every module there, tables built with a call included; nothing in it may
do anything on import alone.

## React Compiler

The renderer uses stable React Compiler through `@vitejs/plugin-react` in
`electron.vite.config.ts`, in both development and production. React 19 supplies its
runtime; main and preload are not compiled with it.

Write ordinary components and hooks: the compiler automatically memoizes eligible
calculations, callbacks, and JSX. Keep rendering pure and follow the Rules of React;
`bun run lint` includes compiler diagnostics. Keep existing `useMemo` / `useCallback`
calls when adopting the compiler; new code generally does not need them just for performance.
The compiler does not replace effect dependencies or Zustand subscriptions.

Vitest runs source code without this transform. The Electron end-to-end tests exercise
the compiled production renderer, including preview and PDF export.

## End-to-end tests

E2E launches explicitly enable Chromium's sandbox, use throwaway profiles, and disconnect
from the desktop's D-Bus session on Linux. The security specs check renderer sandboxing
(including Linux seccomp/no-new-privileges), preload isolation, and enforced CSP violations.
Linux runners must support Chromium's sandbox; do not work around launch failures with
`--no-sandbox`, which defeats these checks. The CSP is build-only, not active in Vite dev.

On Linux, install `Xvfb`: each Playwright worker starts its own virtual X11 desktop, so
parallel tests do not share window focus, pointer state, or the clipboard. This works
on Wayland hosts too, but tests Electron's X11 backend. No outer `xvfb-run` is needed.
Linux defaults to four workers; use `bun run test:e2e --workers=2` to reduce parallelism, or
`--workers=1` to run serially. macOS and Windows default to one worker because their
desktops are not isolated. After building, `bunx playwright test` uses the same fixtures.

E2E specs import `test` from `e2e/harness/launch.ts`, not directly from Playwright. `withApp()`
uses the worker's display automatically; tests that launch or relaunch manually take
`launchApp` from their fixture argument: `async ({ launchApp }) => { … }`.
Xvfb chooses free display numbers, signals readiness before launch, and is stopped at
worker teardown.
