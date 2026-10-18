# Speed check

How the built app holds up under the worst it should ever see, and where it holds up input
or drops frames. It builds, straight through the database:

- a fictional resume with every section full: 6 sections, 5 entries each, 7 long bullets
  each (210 bullets), past the ten pages the preview draws;
- 3,000 versions of it that really differ: each rewrites a few bullets in other words,
  every ninth adds one, every thirteenth removes one, every tenth is named;
- 49 more templates, copies of it with 60 versions each.

Then it times everyday flows on that, and input faster than the app can keep up with:

- reading the pasted resume, then importing it until the preview has drawn its ten pages;
- reloading the app with all of it;
- opening the 3,000-version history, stepping through 20 versions a couple of frames
  apart, holding the arrow key past 60 more (a key every 33 ms), and closing it;
- typing 51 keys fast (30 ms apart) into a bullet;
- hiding and showing the sidebar, then flipping it 10 times;
- opening the list of 50 templates, finding one and opening it, then switching back and
  forth 5 times;
- opening and closing Settings;
- saving the PDF of all 210 bullets.

Each starts once any view transition still running has finished (one holds back the next
change), and ends once its own has, so **time** is until the flow has landed, animation
included. For each it records:

- **long tasks**: main-thread tasks over 50 ms, when the page can't answer input; how many,
  their total (**blocked**), and the **longest**;
- **slowest input**: from a key or click to the next paint;
- **late frames**: gaps between frames over 25 ms, a missed frame at 60 Hz, and the
  **longest**. The reload has none: nothing watched frames while the page loaded.

Run by hand after a change to the editor, preview, history, templates, import or export,
and compare with a run before. Never in CI. It takes about 35 seconds, and about 90 under
`--load 6`.

```sh
# As this computer is
bun run check:speed

# One core shared with 6 busy loops: roughly a slow laptop (Linux only)
bun run check:speed --load 6
```

Each builds first. Each run is kept in `out/speed-check/last.json`, and the next prints its
change against it in brackets; compare runs made the same way, loaded or not.

## Reading it

Times move by about 5% between runs and long tasks by a few ms, so compare against a run
made just before a change rather than an old one. Under `--load` everything slows; what to
look for is which flows block the longest, since those are what a slow computer feels first.
