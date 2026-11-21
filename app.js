(() => {
  'use strict';

  const DATA = window.DATA;
  const SRS = window.CantoneseSRS;

  if (!DATA || !SRS || !Array.isArray(DATA.words) || !Array.isArray(DATA.phrases) || !Array.isArray(DATA.paragraphs)) {
    document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">練習資料載入失敗。</p>';
    return;
  }

  const STORAGE = {
    mode: 'cantonese-daily-mode-v1',
    progress: 'cantonese-daily-progress-v2',
    srs: 'cantonese-daily-srs-v1',
  };

  const MODES = {
    words: {
      label: '單字',
      unit: '個字',
      eyebrow: '常用詞彙 · 由最常用開始',
      placeholder: '打一個詞…',
      prev: '上一個',
      next: '下一個',
      finishLabel: '個字完成',
      lead: '每日練幾個字，好快就變成本能。',
      cap: 20,
      srs: true,
    },
    phrases: {
      label: '短句',
      unit: '句',
      eyebrow: '高頻短句 · 由最常用開始',
      placeholder: '喺度打…',
      prev: '上一句',
      next: '下一句',
      finishLabel: '句完成',
      lead: '每日練幾句，好快就變成本能。',
      cap: 12,
      srs: true,
    },
    paragraphs: {
      label: '段落',
      unit: '段',
      eyebrow: '段落練習 · 一氣呵成',
      placeholder: '打完成段…',
      prev: '上一段',
      next: '下一段',
      finishLabel: '段完成',
      lead: '一段一段咁練，慢慢就會越打越順。',
      cap: Infinity,
      srs: false,
    },
  };

  const MODE_ORDER = ['words', 'phrases', 'paragraphs'];
  const DEFAULT_FEEDBACK = '打啱晒就會自動去下一個。';
  const AUTO_NEXT_MS = 300;
  const MAX_REQUEUES = 2;
  const REQUEUE_GAP = 3;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // Cangjie keys shown as their Chinese key names rather than Latin letters.
  const CANGJIE_KEYS = {
    A: '日', B: '月', C: '金', D: '木', E: '水', F: '火', G: '土',
    H: '竹', I: '戈', J: '十', K: '大', L: '中', M: '一', N: '弓',
    O: '人', P: '心', Q: '手', R: '口', S: '尸', T: '廿', U: '山',
    V: '女', W: '田', X: '難', Y: '卜', Z: '重',
  };

  const el = {
    modeSwitch: document.getElementById('modeSwitch'),
    modeButtons: [...document.querySelectorAll('.mode-btn')],
    counterCurrent: document.getElementById('counterCurrent'),
    counterTotal: document.getElementById('counterTotal'),
    progress: document.getElementById('progress'),
    progressFill: document.getElementById('progressFill'),
    practiceBody: document.getElementById('practiceBody'),
    stage: document.getElementById('stage'),
    practiceLabel: document.getElementById('practiceLabel'),
    category: document.getElementById('category'),
    colloquial: document.getElementById('colloquial'),
    phrase: document.getElementById('phrase'),
    gloss: document.getElementById('gloss'),
    hintBody: document.getElementById('hintTableWrap'),
    hintTable: document.getElementById('hintTable'),
    revealBtn: document.getElementById('revealBtn'),
    revealLabel: document.getElementById('revealLabel'),
    input: document.getElementById('typeInput'),
    typing: document.querySelector('.typing'),
    feedback: document.getElementById('feedback'),
    cpm: document.getElementById('cpm'),
    accuracy: document.getElementById('accuracy'),
    completed: document.getElementById('completed'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    prevLabel: document.getElementById('prevLabel'),
    nextLabel: document.getElementById('nextLabel'),
    keyhintLabel: document.getElementById('keyhintLabel'),
    resetBtn: document.getElementById('resetBtn'),
    finish: document.getElementById('finish'),
    finishTitle: document.getElementById('finishTitle'),
    finishLead: document.getElementById('finishLead'),
    finishCompleted: document.getElementById('finishCompleted'),
    finishCompletedLabel: document.getElementById('finishCompletedLabel'),
    finishAccuracy: document.getElementById('finishAccuracy'),
    finishBest: document.getElementById('finishBest'),
    finishBestLabel: document.getElementById('finishBestLabel'),
    finishPending: document.getElementById('finishPending'),
    restartBtn: document.getElementById('restartBtn'),
    footerTotal: document.getElementById('footerTotal'),
    footerUnit: document.getElementById('footerUnit'),
    toast: document.getElementById('toast'),
    announce: document.getElementById('announce'),
  };

  let mode = readMode();
  let queue = [];
  let pos = 0;

  let revealed = false;
  let completed = false;
  let finished = false;
  let graded = false;
  let composing = false;

  let startTime = 0;
  let finalCpm = 0;
  let lastChars = [];
  let keystrokes = 0;
  let errors = 0;
  let itemErrors = 0;

  let sessionCompleted = 0;
  let sessionKeystrokes = 0;
  let sessionErrors = 0;
  let bestCpm = 0;

  let records = loadRecords();
  const requeues = new Map();

  let resetArmed = false;
  let advanceTimer = null;
  let cpmTimer = null;
  let toastTimer = null;
  let resetArmTimer = null;

  /* ---------- Storage ---------- */

  function readMode() {
    try {
      const saved = window.localStorage.getItem(STORAGE.mode);
      return MODES[saved] ? saved : 'phrases';
    } catch {
      return 'phrases';
    }
  }

  function saveMode(value) {
    try {
      window.localStorage.setItem(STORAGE.mode, value);
    } catch {
      /* storage can be unavailable in private mode */
    }
  }

  function readParagraphIndex() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE.progress) || '{}');
      const index = Number(saved.paragraphs);
      return Number.isInteger(index) && index >= 0 && index < DATA.paragraphs.length ? index : 0;
    } catch {
      return 0;
    }
  }

  function saveParagraphIndex(value) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE.progress) || '{}');
      saved.paragraphs = value;
      window.localStorage.setItem(STORAGE.progress, JSON.stringify(saved));
    } catch {
      /* storage can be unavailable in private mode */
    }
  }

  function loadRecords() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE.srs) || '{}');
      const items = saved && saved.items;
      if (!items || typeof items !== 'object') return {};

      const all = [...DATA.words, ...DATA.phrases, ...DATA.paragraphs];
      return SRS.prune(all, items);
    } catch {
      return {};
    }
  }

  function saveRecords() {
    try {
      window.localStorage.setItem(STORAGE.srs, JSON.stringify({ version: 1, items: records }));
    } catch {
      /* storage can be unavailable in private mode */
    }
  }

  /* ---------- Helpers ---------- */

  const config = () => MODES[mode];
  const items = () => DATA[mode];
  const current = () => queue[pos];
  const targetChars = () => [...current().zh];
  const pad3 = n => String(n).padStart(3, '0');

  function setFeedback(text, tone = '') {
    el.feedback.textContent = text;
    el.feedback.dataset.tone = tone;
  }

  function announce(text) {
    el.announce.textContent = '';
    window.requestAnimationFrame(() => {
      el.announce.textContent = text;
    });
  }

  function toast(text) {
    window.clearTimeout(toastTimer);
    el.toast.textContent = text;
    el.toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      el.toast.classList.remove('is-visible');
    }, 2300);
  }

  function defaultFeedback() {
    if (mode === 'paragraphs') return '打完成段，撳 Enter 或者「下一段」就得。';
    return DEFAULT_FEEDBACK;
  }

  /* ---------- SRS ---------- */

  function recordResult(correct) {
    if (!config().srs || graded) return;
    graded = true;
    const id = current().id;
    records[id] = SRS.grade(records[id], correct);
    saveRecords();
  }

  function requeueCurrent() {
    if (!config().srs) return;
    const id = current().id;
    const used = requeues.get(id) || 0;
    if (used >= MAX_REQUEUES) return;
    requeues.set(id, used + 1);

    const insertAt = Math.min(pos + REQUEUE_GAP, queue.length);
    queue.splice(insertAt, 0, current());
  }

  function pendingCount() {
    if (!config().srs) return 0;
    return SRS.pendingCount(items(), records);
  }

  /* ---------- Rendering ---------- */

  function updateProgress() {
    const done = pos + (completed ? 1 : 0);
    const percent = Math.round((done / queue.length) * 100);
    el.counterTotal.textContent = String(queue.length);
    el.progressFill.style.width = `${percent}%`;
    el.progress.setAttribute('aria-valuenow', String(percent));
    el.progress.setAttribute('aria-valuetext', `${done} / ${queue.length} ${config().unit}`);
  }

  function renderPhrase(chars) {
    const phrase = current().zh;
    const fragment = document.createDocumentFragment();

    [...phrase].forEach((character, i) => {
      const span = document.createElement('span');
      let className = 'char';

      if (completed) {
        className += ' is-correct';
      } else if (i < chars.length) {
        className += chars[i] === character ? ' is-correct' : ' is-wrong';
      } else if (i === chars.length) {
        className += ' is-current';
      }

      span.className = className;
      span.textContent = character;
      fragment.appendChild(span);
    });

    el.phrase.replaceChildren(fragment);
  }

  function makeJyutpingCell(value) {
    const cell = document.createElement('td');
    cell.className = 'is-jp';

    if (!value) {
      cell.textContent = '—';
      return cell;
    }

    const match = value.match(/^(.*?)(\d)$/);
    if (match) {
      cell.append(document.createTextNode(match[1]));
      const tone = document.createElement('span');
      tone.className = 'tone';
      tone.textContent = match[2];
      cell.appendChild(tone);
    } else {
      cell.textContent = value;
    }

    return cell;
  }

  function cangjieGlyphs(code) {
    return [...code].map(letter => CANGJIE_KEYS[letter] || letter).join('');
  }

  function renderHint() {
    const phrase = current();
    const table = el.hintTable;
    table.replaceChildren();
    table.style.setProperty('--cols', String(phrase.chars.length));
    table.hidden = !revealed;
    table.setAttribute('aria-hidden', String(!revealed));
    el.hintBody.hidden = !revealed;
    el.hintBody.classList.toggle('is-revealed', revealed);
    el.revealBtn.setAttribute('aria-expanded', String(revealed));
    el.revealLabel.textContent = revealed ? '收起提示' : '顯示提示';

    if (!revealed) return;

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.scope = 'col';
    corner.setAttribute('aria-hidden', 'true');
    headRow.appendChild(corner);

    phrase.chars.forEach(char => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = char.ch;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    const rows = [
      { label: '倉頡', className: 'is-code is-cangjie', get: char => char.cangjie, glyphs: true },
      { label: '速成', className: 'is-code is-quick', get: char => char.quick, glyphs: true },
      { label: '粵拼', className: 'is-jp', get: char => char.jyutping, isJyutping: true },
      { label: '漢拼', className: 'is-mp', get: char => char.mandarin },
    ];

    rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = row.label;
      tr.appendChild(label);

      phrase.chars.forEach((char, i) => {
        const value = row.get(char);
        let cell;
        if (row.isJyutping) {
          cell = makeJyutpingCell(value);
        } else {
          cell = document.createElement('td');
          cell.className = row.className;
          if (value == null) {
            cell.textContent = '—';
          } else {
            cell.textContent = row.glyphs ? cangjieGlyphs(value) : value;
          }
        }
        cell.style.animationDelay = `${rowIndex * 22 + i * 16}ms`;
        tr.appendChild(cell);
      });

      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
  }

  function updateNav() {
    el.prevBtn.disabled = pos === 0;
    el.nextBtn.disabled = pos === queue.length - 1 && !completed;
  }

  function renderChrome() {
    const phrase = current();
    const cfg = config();

    el.counterCurrent.textContent = pad3(pos + 1);
    el.counterTotal.textContent = String(queue.length);
    el.practiceLabel.textContent = cfg.eyebrow;
    el.category.textContent = phrase.cat;
    el.colloquial.hidden = mode === 'paragraphs' || !phrase.colloquial;
    el.gloss.textContent = phrase.en;
    el.prevLabel.textContent = cfg.prev;
    el.nextLabel.textContent = cfg.next;
    el.keyhintLabel.textContent = cfg.next;
    el.footerTotal.textContent = String(items().length);
    el.footerUnit.textContent = cfg.unit;
    el.input.placeholder = cfg.placeholder;
    el.input.setAttribute('enterkeyhint', mode === 'paragraphs' ? 'done' : 'next');
    el.input.classList.toggle('is-paragraph', mode === 'paragraphs');
    el.stage.classList.toggle('is-paragraph', mode === 'paragraphs');
    el.progress.setAttribute('aria-label', `練習進度，第 ${pos + 1} ${cfg.unit}，共 ${queue.length} ${cfg.unit}`);
    el.stage.setAttribute('aria-label', `練習內容：${phrase.zh}。${phrase.en}`);

    updateNav();
    updateProgress();
  }

  function accuracy() {
    if (keystrokes === 0) return 100;
    return Math.max(0, Math.round(((keystrokes - errors) / keystrokes) * 100));
  }

  function liveCpm() {
    if (!startTime) return 0;
    const seconds = (Date.now() - startTime) / 1000;
    if (seconds < 0.8) return 0;

    const target = targetChars();
    const correct = lastChars.reduce(
      (count, character, i) => count + (character === target[i] ? 1 : 0),
      0
    );
    if (!correct) return 0;
    return Math.min(999, Math.round((correct / seconds) * 60));
  }

  function renderStats() {
    el.cpm.textContent = String(completed ? finalCpm : liveCpm());
    el.accuracy.textContent = `${accuracy()}%`;
    el.completed.textContent = String(sessionCompleted);
  }

  function autoResize() {
    if (mode !== 'paragraphs') {
      el.input.style.height = '';
      el.input.style.overflowY = 'hidden';
      return;
    }
    el.input.style.height = 'auto';
    const height = Math.min(el.input.scrollHeight, 260);
    el.input.style.height = `${height}px`;
    el.input.style.overflowY = el.input.scrollHeight > 260 ? 'auto' : 'hidden';
  }

  /* ---------- Session flow ---------- */

  function stopCpmRefresh() {
    if (cpmTimer !== null) {
      window.clearInterval(cpmTimer);
      cpmTimer = null;
    }
  }

  function startCpmRefresh() {
    stopCpmRefresh();
    cpmTimer = window.setInterval(() => {
      if (!completed) renderStats();
    }, 500);
  }

  function clearAdvance() {
    if (advanceTimer !== null) {
      window.clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function resetPhraseState() {
    clearAdvance();
    stopCpmRefresh();
    completed = false;
    graded = false;
    composing = false;
    revealed = false;
    startTime = 0;
    finalCpm = 0;
    lastChars = [];
    keystrokes = 0;
    errors = 0;
    itemErrors = 0;
    el.input.value = '';
    el.input.readOnly = false;
    el.input.style.height = '';
    el.typing.classList.remove('is-success', 'is-error');
    el.stage.classList.remove('is-complete');
    el.input.classList.remove('is-shaking');
    el.finish.hidden = true;
    el.practiceBody.hidden = false;
  }

  function buildSession() {
    const cfg = config();
    const source = items();

    if (mode === 'paragraphs') {
      queue = source.slice();
      pos = Math.min(readParagraphIndex(), queue.length - 1);
      return;
    }

    queue = SRS.buildQueue(source, records, { cap: cfg.cap });
    // Nothing due: practise ahead instead of showing an empty session.
    if (!queue.length) queue = source.slice(0, cfg.cap);
    pos = 0;
  }

  function goTo(nextPos, { focus = true } = {}) {
    if (nextPos < 0 || nextPos >= queue.length) return;
    pos = nextPos;
    resetPhraseState();
    if (mode === 'paragraphs') saveParagraphIndex(pos);
    renderChrome();
    renderPhrase([]);
    renderHint();
    setFeedback(defaultFeedback());
    renderStats();
    autoResize();

    if (focus) {
      el.input.focus({ preventScroll: true });
    }
  }

  function updateLiveUi() {
    const target = targetChars();
    const hasErrors = lastChars.some((character, i) => character !== target[i]);
    el.typing.classList.toggle('is-error', hasErrors && !completed);

    if (lastChars.length === 0) {
      setFeedback(defaultFeedback());
    } else if (hasErrors) {
      setFeedback(mode === 'paragraphs' ? '有紅字，改返啱先。' : '紅字唔啱，改返佢再繼續。', 'error');
    } else {
      setFeedback('繼續打…');
    }

    renderStats();
  }

  function handleInput() {
    if (finished || completed) return;

    const target = targetChars();
    let chars = [...el.input.value];

    if (chars.length > target.length) {
      chars = chars.slice(0, target.length);
      el.input.value = chars.join('');
    }

    if (chars.length > lastChars.length) {
      for (let i = lastChars.length; i < chars.length; i += 1) {
        keystrokes += 1;
        if (chars[i] !== target[i]) {
          errors += 1;
          itemErrors += 1;
        }
      }
    }

    lastChars = chars;

    if (!startTime && chars.length > 0) {
      startTime = Date.now();
      startCpmRefresh();
    }

    renderPhrase(chars);
    updateLiveUi();
    autoResize();

    if (chars.length === target.length && chars.every((char, i) => char === target[i])) {
      if (mode === 'paragraphs') {
        markParagraphComplete();
      } else {
        completePhrase();
      }
    }
  }

  function finishTiming() {
    const target = targetChars();
    const seconds = Math.max(1, (Date.now() - startTime) / 1000);
    finalCpm = Math.min(999, Math.round((target.length / seconds) * 60));
    if (finalCpm > bestCpm) bestCpm = finalCpm;
    sessionCompleted += 1;
    sessionKeystrokes += keystrokes;
    sessionErrors += errors;
    stopCpmRefresh();
  }

  function completePhrase() {
    if (completed || finished) return;

    const target = targetChars();
    completed = true;
    finishTiming();

    el.input.readOnly = true;
    lastChars = target;
    renderPhrase(target);
    el.stage.classList.add('is-complete');
    el.typing.classList.remove('is-error');
    el.typing.classList.add('is-success');
    setFeedback('啱晒！好嘢。', 'success');
    updateProgress();
    updateNav();
    renderStats();

    const clean = itemErrors === 0;
    recordResult(clean);
    if (!clean) requeueCurrent();
    updateNav();
    updateProgress();

    announce(`啱晒！${current().zh}。下一${config().unit}即將開始。`);

    advanceTimer = window.setTimeout(() => {
      if (pos >= queue.length - 1) showFinish();
      else goTo(pos + 1);
    }, AUTO_NEXT_MS);
  }

  function markParagraphComplete() {
    if (completed || finished) return;

    completed = true;
    finishTiming();
    el.input.readOnly = true;
    lastChars = targetChars();
    renderPhrase(lastChars);
    el.stage.classList.add('is-complete');
    el.typing.classList.remove('is-error');
    el.typing.classList.add('is-success');
    setFeedback('啱晒！撳 Enter 或者「下一段」。', 'success');
    updateProgress();
    updateNav();
    renderStats();
    announce(`啱晒！${current().zh}。撳 Enter 去下一段。`);
  }

  function nextItem() {
    if (finished) return;
    clearAdvance();

    if (!completed && mode !== 'paragraphs' && itemErrors > 0) {
      recordResult(false);
      requeueCurrent();
    }

    if (pos >= queue.length - 1) {
      showFinish();
    } else {
      goTo(pos + 1);
    }
  }

  function showFinish() {
    if (finished) return;
    finished = true;
    completed = true;
    stopCpmRefresh();
    clearAdvance();

    const totalAttempts = sessionKeystrokes;
    const overallAccuracy = totalAttempts
      ? Math.max(0, Math.round(((totalAttempts - sessionErrors) / totalAttempts) * 100))
      : 100;

    el.finishCompleted.textContent = String(sessionCompleted);
    el.finishCompletedLabel.textContent = config().finishLabel;
    el.finishAccuracy.textContent = `${overallAccuracy}%`;
    el.finishBest.textContent = String(bestCpm || finalCpm);
    el.finishBestLabel.textContent = '最快字 / 分';
    el.finishTitle.textContent = '練完喇！';
    el.finishLead.textContent = config().lead;

    const pending = pendingCount();
    el.finishPending.hidden = !config().srs;
    el.finishPending.textContent = pending
      ? `仲有 ${pending} ${config().unit}未練完。`
      : '全部練完喇，聽日再嚟。';

    el.practiceBody.hidden = true;
    el.finish.hidden = false;
    el.progressFill.style.width = '100%';
    el.progress.setAttribute('aria-valuenow', '100');
    el.progress.setAttribute('aria-valuetext', `${queue.length} / ${queue.length} ${config().unit}`);
    if (mode === 'paragraphs') saveParagraphIndex(0);
    announce(`全部 ${queue.length} ${config().unit}完成。`);
    el.restartBtn.focus({ preventScroll: true });
  }

  function resetSessionStats() {
    sessionCompleted = 0;
    sessionKeystrokes = 0;
    sessionErrors = 0;
    bestCpm = 0;
  }

  function startSession({ clearRecords = false, keepParagraphPosition = false } = {}) {
    if (clearRecords && config().srs) {
      items().forEach(item => {
        delete records[item.id];
      });
      saveRecords();
    }

    if (mode === 'paragraphs' && !keepParagraphPosition) saveParagraphIndex(0);

    resetSessionStats();
    requeues.clear();
    finished = false;
    buildSession();
    goTo(pos, { focus: !isCoarsePointer });
  }

  function resetProgress(message) {
    startSession({ clearRecords: true });
    toast(message);
    announce(message);
  }

  /* ---------- Modes ---------- */

  function updateModeButtons() {
    el.modeButtons.forEach(button => {
      const selected = button.dataset.mode === mode;
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  function setMode(next, { focus = true } = {}) {
    if (!MODES[next] || next === mode) return;
    mode = next;
    saveMode(mode);
    updateModeButtons();
    startSession({ keepParagraphPosition: true });
    announce(`已轉去${config().label}模式。`);
    if (focus && !isCoarsePointer) {
      el.input.focus({ preventScroll: true });
    }
  }

  /* ---------- Events ---------- */

  el.input.addEventListener('compositionstart', () => {
    composing = true;
  });

  el.input.addEventListener('compositionend', () => {
    composing = false;
    handleInput();
  });

  el.input.addEventListener('input', () => {
    if (!composing) handleInput();
  });

  el.input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();

    if (finished) return;

    if (completed) {
      nextItem();
      return;
    }

    el.input.classList.remove('is-shaking');
    void el.input.offsetWidth;
    el.input.classList.add('is-shaking');
    setFeedback(mode === 'paragraphs' ? '仲未打完，打完成段先。' : '仲爭少少，打埋佢先。', 'error');
    window.setTimeout(() => el.input.classList.remove('is-shaking'), 450);
  });

  el.revealBtn.addEventListener('click', () => {
    revealed = !revealed;
    renderHint();
    announce(revealed ? '提示已顯示。' : '提示已收起。');
  });

  el.prevBtn.addEventListener('click', () => {
    if (pos > 0) goTo(pos - 1);
  });

  el.nextBtn.addEventListener('click', nextItem);

  el.stage.addEventListener('click', () => {
    if (!finished && !completed) {
      el.input.focus({ preventScroll: true });
    }
  });

  el.modeSwitch.addEventListener('click', event => {
    const button = event.target.closest('.mode-btn');
    if (button) setMode(button.dataset.mode);
  });

  el.modeSwitch.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const index = MODE_ORDER.indexOf(mode);
    const next = MODE_ORDER[(index + direction + MODE_ORDER.length) % MODE_ORDER.length];
    setMode(next, { focus: false });
    const button = el.modeButtons.find(candidate => candidate.dataset.mode === next);
    if (button) button.focus();
  });

  el.resetBtn.addEventListener('click', () => {
    if (resetArmed) {
      disarmReset();
      resetProgress('已清除今次模式嘅進度同記憶。');
    } else {
      armReset();
    }
  });

  el.restartBtn.addEventListener('click', () => {
    startSession();
    toast('再嚟一次。');
  });

  function armReset() {
    resetArmed = true;
    el.resetBtn.textContent = '再撳一次確認';
    el.resetBtn.classList.add('is-armed');
    window.clearTimeout(resetArmTimer);
    resetArmTimer = window.setTimeout(disarmReset, 2800);
  }

  function disarmReset() {
    resetArmed = false;
    el.resetBtn.textContent = '重設進度';
    el.resetBtn.classList.remove('is-armed');
    window.clearTimeout(resetArmTimer);
  }

  /* ---------- Start ---------- */

  updateModeButtons();
  buildSession();
  goTo(pos, { focus: !isCoarsePointer });
})();
