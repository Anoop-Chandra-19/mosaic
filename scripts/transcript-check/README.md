# Transcript check

How the assistant's pane holds up under a conversation of 2,000 fictional messages (500 runs,
with replies from a short note to a long one). The developer tools write it, the same every
run; it also loads by hand from the palette (Open a long conversation). Then it measures:

- **reopened**: reloading the app with the pane on that conversation, until the newest ask shows;
- **wheel up**: fast wheel turns through the newest page;
- **back to the first message**: going to the top, again and again, until the first ask is
  there, which reads and lands every older page;
- **wheel down**: fast wheel turns through what is held;
- **back to the newest**: going to the end, again and again, until the last ask is there, which
  reads every newer page again;
- **a send from the first message**: back at the top, sending a message on the scripted model,
  until its reply shows at the bottom.

The pane holds 400 messages at most, so **runs shown** stays near 100 however far it scrolls.

For each it records the **time**, the **runs shown**, the page's **long tasks** (over 50 ms) and
the **longest**, **late frames** (gaps over 25 ms), then, after a collection, the **heap**, the
renderer's memory, its **DOM nodes**, and two counts of the whole app: **all** adds up what each
process reports, counting the libraries they share in every one, and **shared once** counts
them once (Linux only), which is nearer what the app really takes.

Run by hand after a change to the transcript or how it reads messages, and compare with a run
before. Never in CI.

```sh
bun run check:transcript

# One core shared with 6 busy loops: roughly a slow laptop (Linux only)
bun run check:transcript --load 6
```

Each builds first. Each run is kept in `out/transcript-check/last.json`, and the next prints its
change since then. Under `--load 6` the longest task landing a page should stay under 100 ms.

Anything the check does in the page counts in what it measures: its scroll back asks only for
the first turn, since searching the whole transcript each time cost more than the pages landing.
