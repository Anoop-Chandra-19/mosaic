# Development

Details for working on Mosaic: development data, the React Compiler, and end-to-end tests.
Setup and scripts are in the [README](../README.md).

## Development data

Development runs keep their data in the repo's gitignored `.dev-data/`, never an installed
Mosaic's profile. Quit the app before `bun run dev:reset`, which deletes that data.

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

E2E specs import `test` from `e2e/launch.ts`, not directly from Playwright. `withApp()`
uses the worker's display automatically; tests that launch or relaunch manually take
`launchApp` from their fixture argument: `async ({ launchApp }) => { … }`.
Xvfb chooses free display numbers, signals readiness before launch, and is stopped at
worker teardown.
