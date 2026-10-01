# Typing check

Whether the editor and the live preview keep up with typing. It types into a bullet of a
1-, 3-, and 7-page fictional resume in the built app, a key every 60ms (a fast burst), and
prints for each one:

- **page loop**: a fixed loop timed in the page, to tell how fast the run's renderer was;
- **slowest key**: from a key to the next paint, flagged past 50ms, where lag starts to show;
- **preview updated**: how many keys the preview redrew for (React skips some under load);
- **caught up**: how long after the last key the preview showed it.

Run by hand when the editor, the preview, or pagination changes, and compare with a run
before the change. Never in CI. Needs a build (`bun run build`).

## Runs

```sh
# As this computer is
node scripts/typing-check/runTypingCheck.ts

# One core shared with 6 busy loops: roughly a slow laptop (Linux only)
node scripts/typing-check/runTypingCheck.ts --load 6
```

Compare the page loop between runs to see how much slower a loaded run really was.
