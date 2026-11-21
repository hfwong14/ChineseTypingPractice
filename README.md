# 日常粵語 · Cantonese Daily Practice

A quiet, minimal typing practice site for everyday spoken Cantonese. Three modes share one large central display: **單字** (516 everyday words), **短句** (305 common phrases) and **段落** (30 short paragraphs). There is no timer anywhere — pace yourself, and the site keeps track of what deserves another pass.

The hints — **Jyutping**, **Cangjie** and **Quick (速成)** codes — stay hidden until you press **顯示提示**.

## Run it

No build step is required. Open `index.html`, or serve the folder locally:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## What's inside

- **Three practice modes**, switched with the control above the practice card and remembered between visits:
  - **單字** — 516 everyday words, ordered roughly by frequency, in 20-item sessions.
  - **短句** — 305 phrases, from 唔該 and 多謝 to longer conversational lines, in 12-item sessions.
  - **段落** — 30 two-to-four-sentence paragraphs, typed in full with no time limit.
- **Spaced repetition** for words and phrases: a correct answer pushes the item further into the future (1, 3, 7, 16, then 35 days), while a wrong answer brings it straight back — both later in the same session and first in line next time. Paragraphs are not scheduled.
- **Large phrase window** above the typing box, with the current character marked by a caret. Paragraphs wrap and scale down to fit.
- **Per-character hints** for Jyutping, Cangjie (第五代) and Quick — hidden by default, revealed with one button and reset for every new item. Paragraph punctuation shows as `—`.
- **Live feedback**: correct characters turn green, wrong ones turn red; words and phrases advance automatically once typed correctly, while paragraphs wait for `Enter`.
- **Compact stats**: characters per minute, accuracy and items completed this session. 字/分 is a speed readout only, never a limit.
- **Progress memory**: the chosen mode, paragraph position and spaced-repetition schedule are stored in `localStorage`; a two-step reset clears the current mode.
- Responsive layout, keyboard support (`Enter` advances, arrow keys switch modes), and reduced-motion support.

## About the data

- **Words and phrases** are curated for daily Hong Kong Cantonese, roughly ordered by frequency. The English line under each item is a short gloss, not a literal translation.
- **Paragraphs** are short everyday passages with full punctuation; punctuation is part of what you type.
- **Jyutping** is generated with [to-jyutping](https://github.com/CanCLID/to-jyutping) (CanCLID). Small overrides keep colloquial readings consistent, for example 呢 → `ni1`.
- **Cangjie** codes come from Unicode's Unihan `kCangjie` field, with [`@jimmyclchu/cangjie`](https://www.npmjs.com/package/@jimmyclchu/cangjie) as a fallback. The cached subset used by the build is in `data-tools/unihan-subset.json`.
- **Quick (速成)** codes are derived from the Cangjie code: first and last letter (a single-letter code stays as is).
- “Pinyin” on a Cantonese site means **Jyutping**, the Cantonese romanisation — not Mandarin pinyin. The hint table also shows 漢拼 (Mandarin) for reference.

To regenerate `data.js` after editing any dataset:

```sh
cd data-tools
npm install
npm run build
```

The build validates every entry and fails fast on non-Han text in words or phrases, unsupported paragraph characters, duplicates, or missing codes. It prints the dataset counts, unique-character count and any characters that needed the Cangjie fallback.

## Files

```
index.html              the practice page
styles.css              layout and visual design
app.js                  modes, typing, hints, stats, progress and SRS wiring
srs.js                  pure spaced-repetition scheduling
data.js                 generated word / phrase / paragraph data
favicon.svg             small seal mark
data-tools/             datasets + data generation
data-tools/data/        words.js, phrases.js, paragraphs.js (sources of truth)
legacy/single-character.html   earlier single-character practice page
```

## License

The site code is free to reuse. Word, phrase and paragraph data and their codes are derived from the sources above; check their licences before redistributing in bulk.
