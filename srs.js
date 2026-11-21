/* Spaced repetition for 單字 and 短句.
   Pure logic: no DOM, no storage. app.js owns persistence. */
(() => {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;
  // Box 0 means "again this session"; later boxes are days until the next review.
  const INTERVALS = [0, 1, 3, 7, 16, 35];
  const MAX_BOX = INTERVALS.length - 1;

  function newRecord(now = Date.now()) {
    return { box: 0, due: now, lapses: 0, seen: 0, lastResult: null };
  }

  // A correct answer promotes one box; a wrong answer resets to box 0.
  function grade(record, correct, now = Date.now()) {
    const next = record ? { ...record } : newRecord(now);
    next.seen = (next.seen || 0) + 1;

    if (correct) {
      next.box = Math.min((next.box || 0) + 1, MAX_BOX);
      next.lastResult = 'correct';
    } else {
      next.box = 0;
      next.lapses = (next.lapses || 0) + 1;
      next.lastResult = 'wrong';
    }

    next.due = now + INTERVALS[next.box] * DAY;
    return next;
  }

  function isDue(record, now = Date.now()) {
    return Boolean(record) && record.due <= now;
  }

  // Due items first (oldest due first), then unseen items in curriculum order.
  function buildQueue(items, records, { cap = Infinity, now = Date.now() } = {}) {
    const due = [];
    const fresh = [];

    items.forEach(item => {
      const record = records[item.id];
      if (!record) fresh.push(item);
      else if (record.due <= now) due.push({ item, due: record.due });
    });

    due.sort((a, b) => a.due - b.due);
    return [...due.map(entry => entry.item), ...fresh].slice(0, cap);
  }

  // Items that are due for review or have never been seen.
  function pendingCount(items, records, now = Date.now()) {
    return items.reduce((count, item) => {
      const record = records[item.id];
      return count + (!record || record.due <= now ? 1 : 0);
    }, 0);
  }

  // Drop records whose item no longer exists (renamed or removed text).
  function prune(items, records) {
    const valid = new Set(items.map(item => item.id));
    const next = {};
    Object.keys(records || {}).forEach(id => {
      if (valid.has(id)) next[id] = records[id];
    });
    return next;
  }

  window.CantoneseSRS = {
    DAY,
    INTERVALS,
    MAX_BOX,
    newRecord,
    grade,
    isDue,
    buildQueue,
    pendingCount,
    prune,
  };
})();
