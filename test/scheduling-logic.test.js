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

// ── orderTasksByLoad ──
const G = (yuk) => ({ cognitiveLoad: yuk });

test('orderTasksByLoad gun icinde zor gorevi one alir', () => {
  // 3 gorev, 1 gun -> hepsi ayni gune duser
  const sira = S.orderTasksByLoad([G('low'), G('high'), G('medium')], 1);
  assert.deepStrictEqual(sira.map(x => x.index), [1, 2, 0]);
});

test('orderTasksByLoad esit yukte orijinal sirayi korur', () => {
  const sira = S.orderTasksByLoad([G('high'), G('high'), G('high')], 1);
  assert.deepStrictEqual(sira.map(x => x.index), [0, 1, 2]);
});

test('orderTasksByLoad gun dagilimini degistirmez', () => {
  const gorevler = [G('low'), G('high'), G('low'), G('high'), G('medium'), G('low')];
  const gunSayisi = 3;
  const sira = S.orderTasksByLoad(gorevler, gunSayisi);

  const oncesi = {}, sonrasi = {};
  for (let i = 0; i < gorevler.length; i++) {
    const g = S.targetDayIndex(i, gorevler.length, gunSayisi);
    oncesi[g] = (oncesi[g] || 0) + 1;
  }
  for (const x of sira) sonrasi[x.targetIdx] = (sonrasi[x.targetIdx] || 0) + 1;

  assert.deepStrictEqual(sonrasi, oncesi);
  assert.strictEqual(sira.length, gorevler.length);
});

test('orderTasksByLoad her gorevi tam bir kez dondurur', () => {
  const gorevler = [G('low'), G('high'), G('medium'), G('high')];
  const sira = S.orderTasksByLoad(gorevler, 2);
  const indeksler = sira.map(x => x.index).sort((a, b) => a - b);
  assert.deepStrictEqual(indeksler, [0, 1, 2, 3]);
});

test('orderTasksByLoad eksik/taninmayan yuku medium sayar', () => {
  const sira = S.orderTasksByLoad([G('low'), {}, G('uydurma'), G('high')], 1);
  // high(3) once, sonra iki medium (1 ve 2, orijinal sirayla), en sonda low(0)
  assert.deepStrictEqual(sira.map(x => x.index), [3, 1, 2, 0]);
});

test('orderTasksByLoad snake_case cognitive_load anahtarini da okur', () => {
  const sira = S.orderTasksByLoad([{ cognitive_load: 'low' }, { cognitive_load: 'high' }], 1);
  assert.deepStrictEqual(sira.map(x => x.index), [1, 0]);
});

test('orderTasksByLoad bos listede bos dizi doner', () => {
  assert.deepStrictEqual(S.orderTasksByLoad([], 3), []);
  assert.deepStrictEqual(S.orderTasksByLoad(null, 3), []);
});

test('orderTasksByLoad tek gorevi ilk gune koyar', () => {
  assert.deepStrictEqual(S.orderTasksByLoad([G('high')], 5), [{ index: 0, targetIdx: 0 }]);
});

test('orderTasksByLoad gunleri artan sirayla dondurur', () => {
  const gorevler = [G('low'), G('high'), G('low'), G('high')];
  const sira = S.orderTasksByLoad(gorevler, 2);
  const gunler = sira.map(x => x.targetIdx);
  assert.deepStrictEqual(gunler, [...gunler].sort((a, b) => a - b));
});
