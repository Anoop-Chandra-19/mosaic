# Development

Details for working on Mosaic: development data, the React Compiler, and end-to-end tests.
Setup and scripts are in the [README](../README.md).

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
`DEV_TOOLS` (`features/dev-tools/devTools.ts`).

Replace all data with a profile swaps the development data for a generated set, the same
every time: Fresh (erased, as on first run, keys included, as `dev:reset` does), Everyday
(3 templates, about 40 versions each) or Heavy (12 templates, 600 versions on one holding
the 210-bullet resume the speed check pastes). It asks first, and only Ctrl+Enter goes
ahead. Restore a backup file opens Settings' Restore a backup on a file you pick.

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
installer. Keep the data side-effect free (build it in a function), or the release
bundle keeps it.

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
