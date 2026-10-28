(() => {
  'use strict';

  const PHRASES = window.PHRASES;
  if (!Array.isArray(PHRASES) || PHRASES.length === 0) {
    document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">練習資料載入失敗。</p>';
    return;
  }

  const TOTAL = PHRASES.length;
  const STORAGE_KEY = 'cantonese-daily-progress-v1';
  const AUTO_NEXT_MS = 300;
  const DEFAULT_FEEDBACK = '打啱晒就會自動去下一句。';
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // Cangjie keys shown as their Chinese key names rather than Latin letters.
  const CANGJIE_KEYS = {
    A: '日', B: '月', C: '金', D: '木', E: '水', F: '火', G: '土',
    H: '竹', I: '戈', J: '十', K: '大', L: '中', M: '一', N: '弓',
    O: '人', P: '心', Q: '手', R: '口', S: '尸', T: '廿', U: '山',
    V: '女', W: '田', X: '難', Y: '卜', Z: '重',
  };

  const el = {
    counterCurrent: document.getElementById('counterCurrent'),
    counterTotal: document.getElementById('counterTotal'),
    progress: document.getElementById('progress'),
    progressFill: document.getElementById('progressFill'),
    practiceBody: document.getElementById('practiceBody'),
    stage: document.getElementById('stage'),
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
    resetBtn: document.getElementById('resetBtn'),
    finish: document.getElementById('finish'),
    finishCompleted: document.getElementById('finishCompleted'),
    finishAccuracy: document.getElementById('finishAccuracy'),
    finishBest: document.getElementById('finishBest'),
    restartBtn: document.getElementById('restartBtn'),
    footerTotal: document.getElementById('footerTotal'),
    toast: document.getElementById('toast'),
    announce: document.getElementById('announce'),
  };

  let index = 0;
  let revealed = false;
  let completed = false;
  let finished = false;
  let composing = false;
  let startTime = 0;
  let finalCpm = 0;
  let lastChars = [];
  let keystrokes = 0;
  let errors = 0;
  let sessionCompleted = 0;
  let sessionKeystrokes = 0;
  let sessionErrors = 0;
  let bestCpm = 0;
  let resetArmed = false;
  let advanceTimer = null;
  let tickTimer = null;
  let toastTimer = null;
  let resetArmTimer = null;

  const current = () => PHRASES[index];
  const targetChars = () => [...current().zh];
  const pad3 = n => String(n).padStart(3, '0');

  function readSavedIndex() {
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY));
      return Number.isInteger(saved) && saved >= 0 && saved < TOTAL ? saved : 0;
    } catch {
      return 0;
    }
  }

  function saveIndex(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* storage can be unavailable in private mode */
    }
  }

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

  function updateProgress() {
    const completedUnits = index + (completed ? 1 : 0);
    const percent = Math.round((completedUnits / TOTAL) * 100);
    el.progressFill.style.width = `${percent}%`;
    el.progress.setAttribute('aria-valuenow', String(percent));
    el.progress.setAttribute('aria-valuetext', `${completedUnits} / ${TOTAL} 句`);
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
          cell.textContent = row.glyphs ? cangjieGlyphs(value) : value;
        }
        cell.style.animationDelay = `${rowIndex * 22 + i * 16}ms`;
        tr.appendChild(cell);
      });

      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
  }

  function renderChrome() {
    const phrase = current();
    el.counterCurrent.textContent = pad3(index + 1);
    el.counterTotal.textContent = String(TOTAL);
    el.category.textContent = phrase.cat;
    el.colloquial.hidden = !phrase.colloquial;
    el.gloss.textContent = phrase.en;
    el.prevBtn.disabled = index === 0;
    el.nextBtn.disabled = index === TOTAL - 1;
    el.footerTotal.textContent = String(TOTAL);
    el.progress.setAttribute('aria-label', `練習進度，第 ${index + 1} 句，共 ${TOTAL} 句`);
    el.phrase.closest('.stage').setAttribute('aria-label', `練習句子：${phrase.zh}。${phrase.en}`);
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

  function stopTick() {
    if (tickTimer !== null) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function startTick() {
    stopTick();
    tickTimer = window.setInterval(() => {
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
    stopTick();
    completed = false;
    finished = false;
    composing = false;
    revealed = false;
    startTime = 0;
    finalCpm = 0;
    lastChars = [];
    keystrokes = 0;
    errors = 0;
    el.input.value = '';
    el.input.readOnly = false;
    el.typing.classList.remove('is-success', 'is-error');
    el.stage.classList.remove('is-complete');
    el.input.classList.remove('is-shaking');
    el.finish.hidden = true;
    el.practiceBody.hidden = false;
  }

  function goTo(nextIndex, { focus = true } = {}) {
    if (nextIndex < 0 || nextIndex >= TOTAL) return;
    index = nextIndex;
    resetPhraseState();
    renderChrome();
    renderPhrase([]);
    renderHint();
    setFeedback(DEFAULT_FEEDBACK);
    renderStats();
    saveIndex(index);

    if (focus) {
      el.input.focus({ preventScroll: true });
    }
  }

  function updateLiveUi() {
    const target = targetChars();
    const hasErrors = lastChars.some((character, i) => character !== target[i]);
    el.typing.classList.toggle('is-error', hasErrors && !completed);

    if (lastChars.length === 0) {
      setFeedback(DEFAULT_FEEDBACK);
    } else if (hasErrors) {
      setFeedback('紅字唔啱，改返佢再繼續。', 'error');
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
        if (chars[i] !== target[i]) errors += 1;
      }
    }

    lastChars = chars;

    if (!startTime && chars.length > 0) {
      startTime = Date.now();
      startTick();
    }

    renderPhrase(chars);
    updateLiveUi();

    if (chars.length === target.length && chars.every((char, i) => char === target[i])) {
      completePhrase();
    }
  }

  function completePhrase() {
    if (completed || finished) return;

    const target = targetChars();
    completed = true;

    const seconds = Math.max(1, (Date.now() - startTime) / 1000);
    finalCpm = Math.min(999, Math.round((target.length / seconds) * 60));

    if (finalCpm > bestCpm) bestCpm = finalCpm;

    sessionCompleted += 1;
    sessionKeystrokes += keystrokes;
    sessionErrors += errors;

    stopTick();
    el.input.readOnly = true;
    lastChars = target;
    renderPhrase(target);
    el.stage.classList.add('is-complete');
    el.typing.classList.remove('is-error');
    el.typing.classList.add('is-success');
    setFeedback('啱晒！好嘢。', 'success');
    updateProgress();
    renderStats();
    announce(`啱晒！${current().zh}。下一句即將開始。`);

    if (index >= TOTAL - 1) {
      advanceTimer = window.setTimeout(showFinish, 1250);
    } else {
      advanceTimer = window.setTimeout(() => goTo(index + 1), AUTO_NEXT_MS);
    }
  }

  function advanceNow() {
    clearAdvance();
    if (index >= TOTAL - 1) {
      showFinish();
    } else {
      goTo(index + 1);
    }
  }

  function showFinish() {
    if (finished) return;
    finished = true;
    completed = true;
    stopTick();
    clearAdvance();

    const totalAttempts = sessionKeystrokes;
    const overallAccuracy = totalAttempts
      ? Math.max(0, Math.round(((totalAttempts - sessionErrors) / totalAttempts) * 100))
      : 100;

    el.finishCompleted.textContent = String(sessionCompleted);
    el.finishAccuracy.textContent = `${overallAccuracy}%`;
    el.finishBest.textContent = String(bestCpm || finalCpm);
    el.practiceBody.hidden = true;
    el.finish.hidden = false;
    el.progressFill.style.width = '100%';
    el.progress.setAttribute('aria-valuenow', '100');
    el.progress.setAttribute('aria-valuetext', `${TOTAL} / ${TOTAL} 句`);
    saveIndex(0);
    announce(`全部 ${TOTAL} 句完成。`);
    el.restartBtn.focus({ preventScroll: true });
  }

  function resetSession(message) {
    sessionCompleted = 0;
    sessionKeystrokes = 0;
    sessionErrors = 0;
    bestCpm = 0;
    clearAdvance();
    stopTick();
    goTo(0, { focus: !isCoarsePointer });
    toast(message);
  }

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
      advanceNow();
      return;
    }

    el.input.classList.remove('is-shaking');
    void el.input.offsetWidth;
    el.input.classList.add('is-shaking');
    setFeedback('仲爭少少，打埋佢先。', 'error');
    window.setTimeout(() => el.input.classList.remove('is-shaking'), 450);
  });

  el.revealBtn.addEventListener('click', () => {
    revealed = !revealed;
    renderHint();
    announce(revealed ? '提示已顯示。' : '提示已收起。');
  });

  el.prevBtn.addEventListener('click', () => {
    if (index > 0) goTo(index - 1);
  });

  el.nextBtn.addEventListener('click', () => {
    if (index < TOTAL - 1) {
      goTo(index + 1);
    } else if (completed) {
      showFinish();
    }
  });

  el.stage.addEventListener('click', () => {
    if (!finished && !completed) {
      el.input.focus({ preventScroll: true });
    }
  });

  el.resetBtn.addEventListener('click', () => {
    if (resetArmed) {
      disarmReset();
      resetSession('已重設進度，由第一句開始。');
    } else {
      armReset();
    }
  });

  el.restartBtn.addEventListener('click', () => {
    resetSession('由第一句再嚟過。');
  });

  /* ---------- Start ---------- */

  index = readSavedIndex();
  goTo(index, { focus: !isCoarsePointer });
})();
