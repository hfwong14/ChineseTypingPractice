# 日常粵語 · Cantonese Daily Practice

A quiet, minimal typing practice site for everyday spoken Cantonese. One hundred common phrases, ordered from the most frequently used, with a large central display so the next phrase is always easy to read.

The hints — **Jyutping**, **Cangjie** and **Quick (速成)** codes — stay hidden until you press **顯示提示**.

## Run it

No build step is required. Open `index.html`, or serve the folder locally:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## What's inside

- **100 everyday phrases**, starting with 唔該, 多謝 and 你好, and covering colloquial wording such as 啱啱, 佢哋, 喺邊度, 冇所謂, 是但啦 and 嘅.
- **Large phrase window** above the typing box, with the current character marked by a caret.
- **Per-character hints** for Jyutping, Cangjie (第五代) and Quick — hidden by default, revealed with one button and reset for every new phrase.
- **Live feedback**: correct characters turn green, wrong ones turn red; a phrase advances automatically once it is typed correctly.
- **Compact stats**: characters per minute, accuracy and phrases completed this session.
- **Progress memory** via `localStorage`, plus a two-step reset button.
- Responsive layout, keyboard support (`Enter` advances when a phrase is complete) and reduced-motion support.

## About the data

- **Phrases** are curated for daily Hong Kong Cantonese, roughly ordered by frequency. The English line under each phrase is a short gloss, not a literal translation.
- **Jyutping** is generated with [to-jyutping](https://github.com/CanCLID/to-jyutping) (CanCLID). A small override keeps 呢 reading `ni1` consistently.
- **Cangjie** codes come from Unicode's Unihan `kCangjie` field. The cached subset used by the build is in `data-tools/unihan-subset.json`.
- **Quick (速成)** codes are derived from the Cangjie code: first and last letter (a single-letter code stays as is).
- “Pinyin” on a Cantonese site means **Jyutping**, the Cantonese romanisation — not Mandarin pinyin.

To regenerate `data.js` after editing the phrase list:

```sh
cd data-tools
npm install
node build-data.js
```

The build uses `@jimmyclchu/cangjie` as a fallback for any character that is not yet in the cached Unihan subset.

## Files

```
index.html              the practice page
styles.css              layout and visual design
app.js                  typing, hints, stats and progress
data.js                 generated phrase data
favicon.svg             small seal mark
data-tools/             phrase list + data generation
legacy/single-character.html   earlier single-character practice page
```

## License

The site code is free to reuse. Phrase data and codes are derived from the sources above; check their licences before redistributing in bulk.
