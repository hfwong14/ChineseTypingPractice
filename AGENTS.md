# AGENTS.md

Static, no-build typing-practice site for everyday Cantonese. `index.html` loads classic scripts (`data.js`, then `app.js`); there is no bundler, transpiler, or root `package.json`.

## Run and verify

```sh
python3 -m http.server 8000   # from repo root; then open http://localhost:8000
```

`mobile-check.html` embeds `/` in a 360×844 iframe, so it also requires this server (not `file://`).

There are no tests, linter, typechecker, or CI. Verify changes by serving the site and exercising the typing flow manually. Rebuild `data.js` after any phrase change and confirm the diff is intentional; nothing else catches a stale dataset.

## Data pipeline

`data.js` is generated — never hand-edit it. The source of truth is the `phrases` array in `data-tools/build-data.js`:

```sh
cd data-tools
npm install
npm run build          # runs node build-data.js, rewrites ../data.js
```

- Each phrase is `[zh, en, category]`. `zh` must be Han characters only (build rejects anything else).
- The build fails fast on mismatched Jyutping/pinyin/Cangjie lengths or missing codes. It prints `Wrote N phrases, M unique characters.`; the build is deterministic, so an unchanged source should produce no diff.
- Cangjie comes from `data-tools/unihan-subset.json`, with `@jimmyclchu/cangjie` as fallback. The subset currently covers all 138 characters, but new characters may come from the fallback.
- Quick (速成) is derived, not stored: first + last Cangjie letter (single-letter codes unchanged).
- `JYUTPING_OVERRIDES` in `build-data.js` pins colloquial readings such as 呢 → `ni1`.
- The `colloquial` flag is a hardcoded regex in `build-data.js`; add new colloquial characters there or the 口語 badge will be wrong.
- Keep the README's phrase count and claims in sync when the dataset changes.

## Runtime conventions

- `data.js` must define `window.PHRASES`; `app.js` aborts with a load-error page otherwise.
- Progress persists only the current phrase index in `localStorage` key `cantonese-daily-progress-v1`; stats are per-session. Reordering or removing phrases changes what a returning user sees — bump the key if the saved-index meaning changes.
- Data stores Cangjie as Latin letters; `app.js` maps them to Chinese key glyphs via `CANGJIE_KEYS` for display.
- UI copy and feedback are Traditional Chinese / colloquial Cantonese (`zh-HK`). Keep new user-facing text in that voice rather than English.
- `legacy/single-character.html` is an unlinked earlier page; leave it alone unless the task explicitly targets it.
