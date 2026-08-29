const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../scheduling-logic.js');

// ── targetDayIndex ──
test('targetDayIndex tek gorevde 0 doner (T=1 iken NaN regresyonu)', () => {
  assert.strictEqual(S.targetDayIndex(0, 1, 5), 0);
});

test('targetDayIndex tek gunde hep 0 doner', () => {
  assert.strictEqual(S.targetDayIndex(0, 10, 1), 0);
  assert.strictEqual(S.targetDayIndex(9, 10, 1), 0);
});

test('targetDayIndex uclari ilk ve son gune yaslar', () => {
  assert.strictEqual(S.targetDayIndex(0, 10, 5), 0);
  assert.strictEqual(S.targetDayIndex(9, 10, 5), 4);
});

test('targetDayIndex ortayi orantili dagitir', () => {
  // 5 * 4 / 9 = 2.22 -> 2
  assert.strictEqual(S.targetDayIndex(5, 10, 5), 2);
});

test('targetDayIndex bozuk girdide 0 doner', () => {
  assert.strictEqual(S.targetDayIndex(0, 0, 0), 0);
});
