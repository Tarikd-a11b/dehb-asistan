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

// ── dailyCaps ──
// Mod YALNIZCA bugunu degistirir; gorev SILINMEZ, sonraki gunlere yayilir.
test('dailyCaps mod yokken bugunku davranisi aynen korur', () => {
  const c = S.dailyCaps(9, 3, 0);
  assert.deepStrictEqual(c, { todayCap: 3, restCap: 3 });   // eski maxPerDay = ceil(9/3)
});

/** Bugune orantili dagitimda dusen dogal gorev sayisi. */
const dogalBugun = (T, A) => {
  let n = 0;
  for (let i = 0; i < T; i++) if (S.targetDayIndex(i, T, A) === 0) n++;
  return n;
};

test('dailyCaps tavani gunun DOGAL sayisina gore kaydirir, ceil(T/A)ya gore degil', () => {
  // 9 gorev / 4 gun: dogal bugun = 2, ama ceil(9/4) = 3. Tavani 3-1=2 yapmak
  // hicbir seyi degistirmezdi (olculdu: anxious plani mod-yok ile birebir ayniydi).
  assert.strictEqual(dogalBugun(9, 4), 2);
  assert.strictEqual(S.dailyCaps(9, 4, -1).todayCap, 1);
});

test('dailyCaps zor modda bugunu hafifletir', () => {
  const c = S.dailyCaps(9, 3, -1);
  assert.strictEqual(c.todayCap, dogalBugun(9, 3) - 1, 'bugun bir gorev az');
  assert.ok(c.restCap >= 3, 'kalan gunler farki emmeli');
});

test('dailyCaps iyi modda bugune bir gorev ekler', () => {
  const c = S.dailyCaps(9, 3, +1);
  assert.strictEqual(c.todayCap, dogalBugun(9, 3) + 1);
});

test('dailyCaps kalan gunleri ESKISINDEN dar birakmaz (tasma/cakisma korumasi)', () => {
  for (const T of [2, 3, 5, 9, 14, 20]) {
    for (const A of [2, 3, 5, 7]) {
      for (const d of [-1, +1]) {
        const base = Math.ceil(T / A);
        assert.ok(S.dailyCaps(T, A, d).restCap >= base, `T=${T} A=${A} d=${d}`);
      }
    }
  }
});

test('dailyCaps hicbir gorevi dusurmez: toplam kapasite >= gorev sayisi', () => {
  for (const T of [1, 2, 3, 5, 9, 14, 20]) {
    for (const A of [1, 2, 3, 5, 7]) {
      for (const d of [-1, 0, +1]) {
        const { todayCap, restCap } = S.dailyCaps(T, A, d);
        const kapasite = todayCap + (A - 1) * restCap;
        assert.ok(kapasite >= T, `T=${T} A=${A} d=${d} -> kapasite ${kapasite} < ${T}`);
        assert.ok(todayCap >= 1 && restCap >= 1, `T=${T} A=${A} d=${d} -> sifir tavan`);
      }
    }
  }
});

test('dailyCaps tek gunluk planda modu UYGULAMAZ (yayacak gun yok)', () => {
  assert.deepStrictEqual(S.dailyCaps(4, 1, -1), { todayCap: 4, restCap: 4 });
});

test('dailyCaps bugun seansi yoksa modu uygulamaz', () => {
  // Aksam gec saatte parcalanan proje: sessions[0] yarin. Bugunun modu yarina islemez.
  assert.deepStrictEqual(S.dailyCaps(9, 3, -1, false), { todayCap: 3, restCap: 3 });
});

test('dailyCaps bugunku tavani 1in altina indirmez', () => {
  assert.strictEqual(S.dailyCaps(2, 3, -1).todayCap, 1);
});

test('dailyCaps iyi modda bugunu ZORLA doldurmaz: tavan yukselir, gorev cekilmez', () => {
  // Bu bir eksiklik degil, kayit altina alinan bir karar (bkz. dailyCaps yorumu).
  // Yerlestirme orantili; tavani buyutmek bugune gorev tasimaz. Olculdu: hyper
  // modunda gun dagilimi mod-yok ile ayni cikiyor.
  const c = S.dailyCaps(9, 4, +1);
  assert.ok(c.todayCap > dogalBugun(9, 4), 'tavan yukselmeli');
  assert.ok(c.restCap >= Math.ceil(9 / 4), 'kalan gunler daralmamali');
});
