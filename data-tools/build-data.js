const fs = require('fs');
const path = require('path');
const ToJyutping = require('to-jyutping');
const { pinyin } = require('pinyin-pro');
const { Cangjie } = require('@jimmyclchu/cangjie');

// Cangjie codes are cross-checked against Unicode's Unihan kCangjie field.
// The cached subset covers the most common characters; anything else falls back
// to @jimmyclchu/cangjie and is reported at the end of the build.
const unihan = JSON.parse(fs.readFileSync(path.join(__dirname, 'unihan-subset.json'), 'utf8'));
const fallback = new Cangjie();

// A few spoken readings use a colloquial tone or vowel that Unihan does not list.
const JYUTPING_OVERRIDES = {
  '呢': 'ni1', // here: 呢度 / 呢個 (Unihan also lists nei1)
};

// Source of truth for each practice mode. Keep entries as [zh, en, category].
const words = require('./data/words.js');
const phrases = require('./data/phrases.js');
const paragraphs = require('./data/paragraphs.js');

const HAN_ONLY = /^[\u3400-\u9FFF]+$/;
const PUNCTUATION = new Set([...'，。！？、；：…—「」『』（）《》·']);
const isHan = ch => /[\u3400-\u9FFF]/.test(ch);

// Hardcoded on purpose: add new colloquial characters here or the 口語 badge lies.
const COLLOQUIAL = /[唔咗哋嘅喺冇啱嘢佢嚟睇瞓攰唞搵咩咁乜嗰呢啲是㗎啩啫吖喎囉嘛喇餸攞]/;

const usedFallback = new Set();
const seen = new Map();

function cangjieFor(ch) {
  const cached = unihan[ch]?.cangjie;
  if (cached) return cached.toUpperCase();
  const code = fallback.searchCodes(ch)[0];
  if (!code) throw new Error(`Missing Cangjie: ${ch}`);
  usedFallback.add(ch);
  return code.toUpperCase();
}

function quickFor(cangjie) {
  return cangjie.length <= 1 ? cangjie : cangjie[0] + cangjie.at(-1);
}

function jyutpingFor(ch, value) {
  return JYUTPING_OVERRIDES[ch] || value;
}

function mandarinFor(ch, value) {
  // pinyin-pro echoes the character back for some Cantonese-only glyphs.
  return !value || value === ch ? null : value;
}

function buildChars(mode, zh) {
  const characters = [...zh];
  // Whole-string lookups keep polyphone readings in context (行山 vs 銀行).
  const jyutpingList = ToJyutping.getJyutpingList(zh);
  const mandarinList = pinyin(zh, { toneType: 'symbol', type: 'array' });

  if (jyutpingList.length !== characters.length) {
    throw new Error(`Jyutping length mismatch: ${zh} -> ${JSON.stringify(jyutpingList)}`);
  }
  if (mandarinList.length !== characters.length) {
    throw new Error(`Mandarin length mismatch: ${zh} -> ${JSON.stringify(mandarinList)}`);
  }

  const chars = characters.map((ch, index) => {
    if (!isHan(ch)) {
      if (mode !== 'paragraphs') throw new Error(`Non-Han character in ${mode}: ${zh}`);
      if (!PUNCTUATION.has(ch)) throw new Error(`Unsupported paragraph character: ${ch} in ${zh}`);
      return { ch, jyutping: null, mandarin: null, cangjie: null, quick: null };
    }

    const jyutping = jyutpingFor(ch, jyutpingList[index]?.[1]);
    if (!jyutping) throw new Error(`Missing Jyutping: ${ch}`);
    const mandarin = mandarinFor(ch, mandarinList[index]);
    const cangjie = cangjieFor(ch);
    const quick = quickFor(cangjie);
    if (cangjie.length > 5) throw new Error(`Unexpected Cangjie length: ${ch} ${cangjie}`);

    seen.set(ch, { ch, jyutping, mandarin, cangjie, quick });
    return { ch, jyutping, mandarin, cangjie, quick };
  });

  if (mode === 'paragraphs') {
    const han = chars.filter(c => c.cangjie);
    if (han.length === 0) throw new Error(`Paragraph has no Han characters: ${zh}`);
  }

  return chars;
}

function buildDataset(mode, entries) {
  const ids = new Set();
  const texts = new Set();

  return entries.map(([zh, en, cat]) => {
    if (typeof zh !== 'string' || !zh) throw new Error(`Bad entry in ${mode}: ${JSON.stringify([zh, en, cat])}`);
    if (texts.has(zh)) throw new Error(`Duplicate ${mode} text: ${zh}`);
    texts.add(zh);

    if (mode !== 'paragraphs' && !HAN_ONLY.test(zh)) {
      throw new Error(`Non-Han ${mode}: ${zh}`);
    }

    const chars = buildChars(mode, zh);
    const id = `${mode}:${zh}`;
    if (ids.has(id)) throw new Error(`Duplicate id: ${id}`);
    ids.add(id);

    const jyutping = chars.filter(c => c.jyutping).map(c => c.jyutping).join(' ');
    const mandarin = chars.filter(c => c.mandarin).map(c => c.mandarin).join(' ');

    const item = { id, zh, en, cat };
    if (mode !== 'paragraphs') item.colloquial = COLLOQUIAL.test(zh);
    item.jyutping = jyutping;
    item.mandarin = mandarin;
    item.chars = chars;
    return item;
  });
}

const data = {
  words: buildDataset('words', words),
  phrases: buildDataset('phrases', phrases),
  paragraphs: buildDataset('paragraphs', paragraphs),
};

const out = `/* Generated from Unicode-derived Jyutping, Mandarin pinyin and Cangjie data. See data-tools/. */\nwindow.DATA = ${JSON.stringify(data, null, 2)};\nwindow.PHRASES = window.DATA.phrases;\n`;
fs.writeFileSync(path.join(__dirname, '..', 'data.js'), out);

const counts = Object.entries(data)
  .map(([mode, items]) => `${items.length} ${mode}`)
  .join(', ');
console.log(`Wrote ${counts}; ${seen.size} unique characters.`);
if (usedFallback.size) {
  console.log(`Cangjie fallback used for: ${[...usedFallback].join('')}`);
}
