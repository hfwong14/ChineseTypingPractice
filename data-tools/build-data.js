const fs = require('fs');
const path = require('path');
const ToJyutping = require('to-jyutping');
const { pinyin } = require('pinyin-pro');
const { Cangjie } = require('@jimmyclchu/cangjie');

// Cangjie codes are cross-checked against Unicode's Unihan kCangjie field.
// The small cached subset covers every character used below.
const unihan = JSON.parse(fs.readFileSync(path.join(__dirname, 'unihan-subset.json'), 'utf8'));
const fallback = new Cangjie();

// A few spoken readings use a colloquial tone or vowel that Unihan does not list.
const JYUTPING_OVERRIDES = {
  '呢': 'ni1', // here: 呢度 / 呢個 (Unihan also lists nei1)
};

// Curated everyday spoken Cantonese, ordered from most to least common.
const phrases = [
  ['唔該', 'Thanks / please / excuse me', '應對'],
  ['多謝', 'Thank you', '應對'],
  ['你好', 'Hello', '問候'],
  ['早晨', 'Good morning', '問候'],
  ['唔好意思', 'Sorry / excuse me', '應對'],
  ['對唔住', "I'm sorry", '應對'],
  ['冇問題', 'No problem', '應對'],
  ['唔使', "No need / you're welcome", '應對'],
  ['係唔係', 'Is that so?', '問句'],
  ['唔係', 'No / it isn’t', '應對'],
  ['係呀', 'Yes / that’s right', '應對'],
  ['好呀', 'Okay / sure', '應對'],
  ['食咗飯未', 'Have you eaten?', '問候'],
  ['點解', 'Why?', '問句'],
  ['而家', 'Now', '時間'],
  ['佢哋', 'They / them', '代詞'],
  ['我哋', 'We / us', '代詞'],
  ['你哋', 'You (plural)', '代詞'],
  ['呢度', 'Here', '地點'],
  ['嗰度', 'There', '地點'],
  ['邊度', 'Where?', '問句'],
  ['喺邊度', 'Where is it? / Where are you?', '問句'],
  ['呢個', 'This one', '指示'],
  ['嗰個', 'That one', '指示'],
  ['乜嘢', 'What?', '問句'],
  ['咁樣', 'Like this / like that', '指示'],
  ['真係', 'Really / truly', '語氣'],
  ['得閒', 'Have time / free', '時間'],
  ['唔得閒', 'Busy / no time', '時間'],
  ['一齊', 'Together', '日常'],
  ['等陣', 'Wait a moment', '時間'],
  ['遲啲', 'Later', '時間'],
  ['啱啱', 'Just now', '時間'],
  ['唔該晒', 'Thanks a lot', '應對'],
  ['多謝晒', 'Many thanks', '應對'],
  ['好正', 'Awesome / great', '評價'],
  ['好靚', 'Beautiful', '評價'],
  ['好開心', 'Very happy', '情感'],
  ['好攰', 'Very tired', '情感'],
  ['肚餓', 'Hungry', '身體'],
  ['想食嘢', 'Want to eat something', '飲食'],
  ['飲茶', 'Yum cha / dim sum', '飲食'],
  ['得閒飲茶', 'Let’s catch up over dim sum', '飲食'],
  ['食飯', 'Eat / have a meal', '飲食'],
  ['買嘢', 'Go shopping', '購物'],
  ['行街', 'Go for a stroll / shopping', '日常'],
  ['睇戲', 'Watch a movie', '娛樂'],
  ['瞓覺', 'Sleep', '日常'],
  ['返工', 'Go to work', '工作'],
  ['收工', 'Finish work', '工作'],
  ['我走先', "I'm heading off", '日常'],
  ['搞掂', 'Done / sorted', '日常'],
  ['冇所謂', "It doesn't matter", '應對'],
  ['是但啦', "Whatever / I don't mind", '應對'],
  ['唔緊要', 'Never mind', '應對'],
  ['慢慢嚟', 'Take your time', '鼓勵'],
  ['小心啲', 'Be careful', '提醒'],
  ['早唞', 'Good night', '問候'],
  ['搭地鐵', 'Take the MTR', '交通'],
  ['落車', 'Get off (a vehicle)', '交通'],
  ['聽日', 'Tomorrow', '時間'],
  ['聽日見', 'See you tomorrow', '問候'],
  ['今日', 'Today', '時間'],
  ['尋日', 'Yesterday', '時間'],
  ['後日', 'Day after tomorrow', '時間'],
  ['幾多錢', 'How much is it?', '購物'],
  ['太貴', 'Too expensive', '購物'],
  ['平啲得唔得', 'Can it be cheaper?', '購物'],
  ['唔該埋單', 'The bill, please', '飲食'],
  ['唔使客氣', "You're welcome", '應對'],
  ['幫手', 'Lend a hand / help', '日常'],
  ['有冇搞錯', 'Are you kidding?', '語氣'],
  ['咁啱', 'What a coincidence', '語氣'],
  ['好耐冇見', 'Long time no see', '問候'],
  ['最近點呀', 'How have you been?', '問候'],
  ['冇事', "I'm fine / no problem", '應對'],
  ['加油', 'Keep it up / go for it', '鼓勵'],
  ['生日快樂', 'Happy birthday', '祝福'],
  ['我愛你', 'I love you', '情感'],
  ['掛住你', 'Miss you', '情感'],
  ['講真', 'Honestly / for real', '語氣'],
  ['你講乜嘢', 'What did you say?', '問句'],
  ['我聽唔明', "I don't understand", '應對'],
  ['講多次', 'Say it again', '應對'],
  ['大聲啲', 'Speak louder', '應對'],
  ['等陣先', 'Wait a bit first', '時間'],
  ['早啲唞', 'Get some rest early', '問候'],
  ['唔使急', 'No rush', '應對'],
  ['咩事', "What's up? / What happened?", '問句'],
  ['點算好', 'What should we do?', '問句'],
  ['我唔知', "I don't know", '應對'],
  ['我明白', 'I understand', '應對'],
  ['唔該借借', 'Excuse me, coming through', '日常'],
  ['唔該幫我', 'Please help me', '請求'],
  ['搵邊位', 'Who are you looking for?', '電話'],
  ['你叫乜嘢名', "What's your name?", '問候'],
  ['你喺邊度', 'Where are you?', '問句'],
  ['我喺屋企', "I'm at home", '日常'],
  ['佢係邊個', 'Who is he / she?', '問句'],
  ['係真嘅', "It's true", '應對'],
];

const hanOnly = /^[\u3400-\u9FFF]+$/;
const seen = new Map();

function cangjieFor(ch) {
  const cached = unihan[ch]?.cangjie;
  if (cached) return cached.toUpperCase();
  const code = fallback.searchCodes(ch)[0];
  if (!code) throw new Error(`Missing Cangjie: ${ch}`);
  return code.toUpperCase();
}

function quickFor(cangjie) {
  return cangjie.length <= 1 ? cangjie : cangjie[0] + cangjie.at(-1);
}

const data = phrases.map(([zh, en, cat], i) => {
  if (!hanOnly.test(zh)) throw new Error(`Non-Han phrase: ${zh}`);

  const jyutpingList = ToJyutping.getJyutpingList(zh);
  if (jyutpingList.length !== zh.length) {
    throw new Error(`Jyutping length mismatch: ${zh} -> ${JSON.stringify(jyutpingList)}`);
  }

  const mandarinList = pinyin(zh, { toneType: 'symbol', type: 'array' });
  if (mandarinList.length !== zh.length) {
    throw new Error(`Mandarin length mismatch: ${zh} -> ${JSON.stringify(mandarinList)}`);
  }

  const chars = [...zh].map((ch, idx) => {
    const jyutping = JYUTPING_OVERRIDES[ch] || jyutpingList[idx]?.[1];
    if (!jyutping) throw new Error(`Missing Jyutping: ${ch}`);
    const mandarin = mandarinList[idx];
    if (!mandarin) throw new Error(`Missing Mandarin pinyin: ${ch}`);

    const cangjie = cangjieFor(ch);
    const quick = quickFor(cangjie);
    if (cangjie.length > 5) throw new Error(`Unexpected Cangjie length: ${ch} ${cangjie}`);

    seen.set(ch, { ch, jyutping, mandarin, cangjie, quick });
    return { ch, jyutping, mandarin, cangjie, quick };
  });

  return {
    id: i + 1,
    zh,
    en,
    cat,
    colloquial: /[唔咗哋嘅喺冇啱嘢佢嚟睇瞓攰唞搵咩咁乜嗰呢啲是]/.test(zh),
    jyutping: chars.map(c => c.jyutping).join(' '),
    mandarin: chars.map(c => c.mandarin).join(' '),
    chars,
  };
});

const out = `/* Generated from Unicode-derived Jyutping, Mandarin pinyin and Cangjie data. See data-tools/. */\nwindow.PHRASES = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'data.js'), out);

console.log(`Wrote ${data.length} phrases, ${seen.size} unique characters.`);
