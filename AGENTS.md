# AGENTS.md

Static, no-build typing-practice site for everyday Cantonese. `index.html` loads classic scripts (`data.js`, then `srs.js`, then `app.js`); there is no bundler, transpiler, or root `package.json`.

## Run and verify

```sh
python3 -m http.server 8000   # from repo root; then open http://localhost:8000
```

`mobile-check.html` embeds `/` in a 360×844 iframe, so it also requires this server (not `file://`).

There are no committed tests, linter, typechecker, or CI. Verify changes by serving the site and exercising all three practice modes manually. Rebuild `data.js` after any content change and confirm the diff is intentional; nothing else catches a stale dataset.

Node is only needed for the data build (Node 18+). The app itself runs without it. If `node` is missing, install it locally (for example a Node tarball on `PATH`) before running the build.

## Practice modes

Three modes, switched with the segmented control above the practice card and persisted in `localStorage`:

| Mode | Label | Dataset | Session size | Spaced repetition |
|---|---|---|---|---|
| `words` | 單字 | `DATA.words` | 20 items | yes |
| `phrases` | 短句 | `DATA.phrases` | 12 items | yes |
| `paragraphs` | 段落 | `DATA.paragraphs` | full list, linear | **no** |

- `app.js` aborts with a load-error page unless `window.DATA` and `window.CantoneseSRS` exist and all three datasets are arrays.
- Switching modes resets **session** stats but never clears SRS records; paragraph position is preserved.
- `重設進度` is a two-step confirmation that clears the current mode's progress **and** its SRS records. Other modes are untouched.
- `再嚟一次` on the finish screen starts a fresh session without clearing records.

## Pacing (there is no timer)

- There is **no** timer, countdown, or time limit in any mode. Do not add one.
- 字/分 (CPM) is a derived speed readout only. It must never gate, fail, or auto-advance an item. It is computed from correctly typed characters after the first keystroke and capped at 999.
- `words` and `phrases` auto-advance 300 ms after a fully correct copy. `paragraphs` never auto-advance: the user must press `Enter` (or 下一段) after typing the whole paragraph correctly.
- Paragraphs are complete only on an exact match of the full text, including punctuation.

## Spaced repetition

`srs.js` is a pure module exposed as `window.CantoneseSRS`; it does no DOM or storage work. `app.js` owns persistence and requeueing.

Record shape, keyed by item id:

```js
{ box: 0..5, due: <epoch ms>, lapses: 0, seen: 0, lastResult: 'correct' | 'wrong' | null }
```

Rules:

- Correct answer: `box + 1` (max 5), `due = now + INTERVALS[box]`.
- Wrong answer: `box = 0`, `lapses + 1`, `due = now`.
- `INTERVALS = [0, 1, 3, 7, 16, 35]` days. Box 0 means "again this session".
- Queue construction: due items oldest-first, then unseen items in curriculum order, sliced to the mode's session size. If nothing is due, practise ahead with the first items rather than showing an empty session.
- A wrong item is also spliced back into the live queue at `current + 3`, at most twice per item per session, so it reappears soon.
- Grade each item once per attempt (`graded` flag). Fixing red characters before finishing still counts as a wrong attempt for SRS; the item still advances.
- Storage key `cantonese-daily-srs-v1` holds `{ version: 1, items: { [id]: record } }`. Unknown ids are pruned on load, so **changing a phrase's text creates a new item and discards its history**.
- Paragraphs never read or write SRS records.

## Data pipeline

`data.js` is generated — never hand-edit it. Sources of truth:

```
data-tools/data/words.js        [zh, en, category] for 單字
data-tools/data/phrases.js      [zh, en, category] for 短句
data-tools/data/paragraphs.js   [zh, en, category] for 段落
```

```sh
cd data-tools
npm install
npm run build          # runs node build-data.js, rewrites ../data.js
```

Rules enforced by the build (it fails fast):

- `words` and `phrases` must be Han characters only (`/^[\u3400-\u9FFF]+$/`).
- `paragraphs` may use Han characters plus `，。！？、；：…—「」『』（）《》·`; nothing else.
- Duplicate text within a dataset, or a duplicate id, aborts the build.
- IDs are stable and mode-prefixed: `` `${mode}:${zh}` ``. They are the SRS keys, so reordering or inserting entries is safe, but renaming text is not.
- Jyutping comes from `to-jyutping` (with `JYUTPING_OVERRIDES` for colloquial readings such as 呢 → `ni1`), Mandarin from `pinyin-pro`, Cangjie from `unihan-subset.json` with `@jimmyclchu/cangjie` as fallback. Quick (速成) is derived as first + last Cangjie letter (single-letter codes unchanged).
- The build prints dataset counts, the number of unique characters, and every character that used the Cangjie fallback. If that list grows, consider refreshing `unihan-subset.json`.
- The `colloquial` flag is a hardcoded regex in `build-data.js`; add new 口語 characters there or the 口語 badge will be wrong. It is not stored for paragraphs.
- Keep the README's counts and claims in sync when the dataset changes.

`data.js` exposes:

```js
window.DATA = { words: [...], phrases: [...], paragraphs: [...] };
window.PHRASES = window.DATA.phrases;   // compatibility alias
```

Each item has `{ id, zh, en, cat, colloquial?, jyutping, mandarin, chars }`; each char has `{ ch, jyutping, mandarin, cangjie, quick }`, with `null` code fields for paragraph punctuation.

## Runtime conventions

- Storage keys:
  - `cantonese-daily-mode-v1` — selected mode (`words` / `phrases` / `paragraphs`).
  - `cantonese-daily-progress-v2` — `{ paragraphs: n }`, the saved paragraph position. Bumped from v1 because the old value meant "phrase index".
  - `cantonese-daily-srs-v1` — SRS records.
  - `cantonese-daily-progress-v1` — legacy phrases index; intentionally ignored.
- All storage reads/writes are wrapped in `try/catch` because `localStorage` can be unavailable.
- Data stores Cangjie as Latin letters; `app.js` maps them to Chinese key glyphs via `CANGJIE_KEYS` for display. Paragraph punctuation renders as `—`.
- The typing input is a `<textarea>` for every mode (auto-grown only in paragraph mode) so long paragraphs wrap. `Enter` is always intercepted: it advances when complete, otherwise shakes and shows an error.
- UI copy and feedback are Traditional Chinese / colloquial Cantonese (`zh-HK`). Keep new user-facing text in that voice rather than English.
- Accessibility wiring is deliberate: radiogroup semantics and arrow keys for the mode switch, `aria-live` announcements, progressbar attributes, roving focus, and reduced-motion support. Preserve it when editing.
- `legacy/single-character.html` is an unlinked earlier page; leave it alone unless the task explicitly targets it.

## Verification checklist

- Build the data and confirm counts plus a clean, intentional `data.js` diff.
- Each mode renders, switches, and survives a reload; mode persists.
- No countdown or time-limit UI appears anywhere.
- A wrong word/phrase reappears 2–4 items later and is due immediately next session; a correct one is not requeued and is scheduled in the future.
- SRS records survive a reload and are pruned when item text changes.
- Paragraphs require the full correct text, never auto-advance, and never create SRS records.
- Punctuation shows in the target and as `—` in hints.
- Reset clears only the current mode's progress and records.
- IME composition does not create false errors or double-count input.
- Check the 360 px layout (`mobile-check.html`), keyboard-only operation, reduced motion, and screen-reader announcements.
