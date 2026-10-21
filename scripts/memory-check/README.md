# Memory check

How much memory the built app holds, and whether opening and closing views leaves anything
behind. It:

1. launches to the Start panel;
2. loads the developer tools' Heavy profile, the same every run: 12 templates, with 600
   versions of a fictional 210-bullet resume on the open one, then quits and launches
   again over it, so main holds what reading it takes, not what writing it left;
3. steps through 40 of them in the full history;
4. opens and closes the full history, Settings, Export and the shortcuts sheet, twenty rounds.

After each stage it collects the page's garbage and records:

- **page JS** and **main JS**: live JavaScript in the renderer and in main;
- **DOM nodes** and **listeners**: what the page holds on to;
- **renderer**, **main**, **GPU**, **other**: each process's resident memory, as the OS counts
  it, and their **total**;
- **total (PSS)**, on Linux: the same with memory the processes share (Chromium's own
  libraries) counted once. `total` counts it in every process, so PSS is the honest figure.

Page JS climbs over the first ten rounds of step 4 as caches fill and code is compiled, then
levels off (over 50 rounds it stayed within 0.3 MB after round 25). So the check ends with
what each of the last ten rounds left behind, once warmed up. Anything there above about
zero is a leak: DOM nodes or listeners mean views left mounted or handlers never removed;
page JS alone is worth a heap snapshot.

Run by hand after changing what a view keeps (stores, caches, history reading, the preview)
and compare with a run before. Never in CI.

```sh
bun run check:memory
```

It builds first. To measure the build already in `out/` as it is, run its Playwright config
directly: `bunx playwright test -c scripts/memory-check/playwright.config.ts`.

Each run is kept in `out/memory-check/last.json`, and the next prints its change against it
in brackets.

## Reading it

Page JS, DOM nodes and listeners repeat exactly from run to run. Process sizes move by
10–20 MB between runs, the GPU process most. On Linux the app runs on its own Xvfb desktop
with no GPU, so the GPU process draws in software and holds more than it would on a desktop.
