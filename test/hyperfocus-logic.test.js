const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../hyperfocus-logic.js');

const DK = 60000;
const T0 = Date.UTC(2026, 7, 30, 9, 0, 0);   // sabit baslangic; gercek saat kullanilmaz

/** Tek tik. Aradaki bosluk mola esigini asarsa mola sayilir — bilerek. */
const tik = (state, dakika, limit = 60) =>
  H.hyperfocusTick(state, { nowMs: T0 + dakika * DK, limitMinutes: limit });

/**
 * Gercek kullanimi taklit eder: seyrek degil, SIK tik. Gercekte 30 sn'de bir
 * atiliyor; testte 5 dakikalik adim yeterli (mola esigi 10 dk'nin altinda).
 */
function ilerlet(state, baslangicDk, hedefDk, limit = 60, adim = 5) {
  let s = state;
  const alarmlar = [];
  for (let d = baslangicDk; d <= hedefDk + 1e-9; d += adim) {
    const r = H.hyperfocusTick(s, { nowMs: T0 + d * DK, limitMinutes: limit });
    s = r.state;
    if (r.alarm) alarmlar.push({ ...r.alarm, dk: d });
  }
  return { state: s, alarmlar, son: alarmlar[alarmlar.length - 1] || null };
}

// ── parseHyperfocusLimit ──
test('parseHyperfocusLimit none icin 0 doner (alarm kapali)', () => {
  assert.strictEqual(H.parseHyperfocusLimit('none'), 0);
});

test('parseHyperfocusLimit sayiya cevirir', () => {
  assert.strictEqual(H.parseHyperfocusLimit('60'), 60);
  assert.strictEqual(H.parseHyperfocusLimit(90), 90);
});

test('parseHyperfocusLimit bos/bozuk/negatif degerde 0 doner', () => {
  assert.strictEqual(H.parseHyperfocusLimit(''), 0);
  assert.strictEqual(H.parseHyperfocusLimit(undefined), 0);
  assert.strictEqual(H.parseHyperfocusLimit(null), 0);
  assert.strictEqual(H.parseHyperfocusLimit('abc'), 0);
  assert.strictEqual(H.parseHyperfocusLimit(-30), 0);
});

// ── kapali alarm ──
test('limit 0 iken hicbir sey olmaz ve varsa durum silinir', () => {
  const r = H.hyperfocusTick({ startMs: T0, lastTickMs: T0, lastAlarmMs: null },
                             { nowMs: T0 + 500 * DK, limitMinutes: 0 });
  assert.strictEqual(r.state, null);
  assert.strictEqual(r.alarm, null);
});

// ── seri baslangici ──
test('durum yokken yeni seri baslar, alarm calmaz', () => {
  const r = tik(null, 0);
  assert.strictEqual(r.state.startMs, T0);
  assert.strictEqual(r.state.lastTickMs, T0);
  assert.strictEqual(r.state.lastAlarmMs, null);
  assert.strictEqual(r.alarm, null);
});

// ── alarm esigi ──
test('limitin altinda alarm calmaz', () => {
  assert.strictEqual(ilerlet(null, 0, 55).alarmlar.length, 0);
});

test('limit dolunca alarm calar ve gecen sure raporlanir', () => {
  const { alarmlar, state } = ilerlet(null, 0, 60);
  assert.strictEqual(alarmlar.length, 1, 'tam bir alarm bekleniyordu');
  assert.strictEqual(alarmlar[0].elapsedMinutes, 60);
  assert.strictEqual(alarmlar[0].limitMinutes, 60);
  assert.strictEqual(state.lastAlarmMs, T0 + 60 * DK);
});

test('alarm caldiktan sonra limit dolana kadar tekrar calmaz', () => {
  const { alarmlar } = ilerlet(null, 0, 115);
  assert.strictEqual(alarmlar.length, 1);
  assert.strictEqual(alarmlar[0].dk, 60);
});

test('"N dakikada BIR" sozu: ikinci limitte yeniden calar', () => {
  const { alarmlar } = ilerlet(null, 0, 120);
  assert.strictEqual(alarmlar.length, 2);
  assert.strictEqual(alarmlar[1].dk, 120);
  assert.strictEqual(alarmlar[1].elapsedMinutes, 120);
});

// ── mola tespiti ──
test('mola esigi kadar bosluk seriyi sifirlar', () => {
  const s = ilerlet(null, 0, 30).state;
  const r = tik(s, 40);                  // 10 dk bosluk = mola
  assert.strictEqual(r.alarm, null);
  assert.strictEqual(r.state.startMs, T0 + 40 * DK);
  assert.strictEqual(r.state.lastAlarmMs, null);
});

test('molanin ardindan sayac sifirdan sayar, eski sure tasinmaz', () => {
  const s = ilerlet(null, 0, 50).state;
  const molaSonrasi = tik(s, 100).state;               // 50 dk bosluk = mola
  assert.strictEqual(molaSonrasi.startMs, T0 + 100 * DK);
  const { alarmlar } = ilerlet(molaSonrasi, 105, 155); // molanin uzerine 55 dk
  assert.strictEqual(alarmlar.length, 0, 'mola sonrasi 55 dk ile calmamali');
  const { alarmlar: a2 } = ilerlet(molaSonrasi, 105, 160);
  assert.strictEqual(a2.length, 1, 'mola sonrasi 60 dk dolunca calmali');
  assert.strictEqual(a2[0].elapsedMinutes, 60);
});

test('mola esigi altindaki bosluk seriyi kirmaz', () => {
  const s = tik(null, 0).state;
  assert.strictEqual(tik(s, 9).state.startMs, T0);     // 9 dk < 10 dk esigi
});

test('mola esigi disaridan degistirilebilir', () => {
  const s = tik(null, 0).state;
  const r = H.hyperfocusTick(s, { nowMs: T0 + 3 * DK, limitMinutes: 60, breakMinutes: 2 });
  assert.strictEqual(r.state.startMs, T0 + 3 * DK);
});

// ── dayaniklilik ──
test('sayfa yenileme mola degildir: kayitli durumla devam edilir', () => {
  // 39 dk once baslamis, localStorage'dan geri yuklenmis seri
  const kayitli = { startMs: T0, lastTickMs: T0 + 39 * DK, lastAlarmMs: null };
  const { alarmlar, state } = ilerlet(kayitli, 40, 60);
  assert.strictEqual(alarmlar.length, 1, 'yenileme sonrasi sayac devam etmeli');
  assert.strictEqual(state.startMs, T0);
});

test('saat geriye giderse seri yeniden baslar', () => {
  const s = { startMs: T0, lastTickMs: T0 + 60 * DK, lastAlarmMs: null };
  const r = tik(s, 10);                  // now < lastTickMs
  assert.strictEqual(r.alarm, null);
  assert.strictEqual(r.state.startMs, T0 + 10 * DK);
});

test('bozuk durum nesnesi cokme yerine yeni seri baslatir', () => {
  for (const bozuk of [{}, { startMs: NaN, lastTickMs: NaN }, 'x', 42]) {
    const r = tik(bozuk, 0);
    assert.strictEqual(r.state.startMs, T0, `bozuk girdi: ${JSON.stringify(bozuk)}`);
    assert.strictEqual(r.alarm, null);
  }
});

// ── erteleme ──
test('snoozeHyperfocus alarmi ileri atar, seriyi sifirlamaz', () => {
  const s = { startMs: T0, lastTickMs: T0 + 60 * DK, lastAlarmMs: T0 + 60 * DK };
  const y = H.snoozeHyperfocus(s, T0 + 60 * DK, 5);
  assert.strictEqual(y.startMs, T0, 'seri korunmali');
  assert.strictEqual(ilerlet(y, 61, 64).alarmlar.length, 0, 'erteleme dolmadan calmamali');
  const { alarmlar } = ilerlet(y, 61, 66, 60, 1);
  assert.strictEqual(alarmlar.length, 1, 'erteleme dolunca calmali');
  assert.strictEqual(alarmlar[0].dk, 65);
});

test('ertelemeden sonra normal dongu devam eder', () => {
  const s = { startMs: T0, lastTickMs: T0 + 60 * DK, lastAlarmMs: T0 + 60 * DK };
  const y = H.snoozeHyperfocus(s, T0 + 60 * DK, 5);
  const { alarmlar } = ilerlet(y, 61, 130, 60, 1);
  assert.deepStrictEqual(alarmlar.map(a => a.dk), [65, 125]);
});

test('snoozeHyperfocus durum yoksa null doner', () => {
  assert.strictEqual(H.snoozeHyperfocus(null, T0, 5), null);
});

// ── mola verdim ──
test('resetHyperfocus seriyi bastan baslatir', () => {
  const s = ilerlet(null, 0, 60).state;
  const y = H.resetHyperfocus(T0 + 60 * DK);
  assert.strictEqual(y.startMs, T0 + 60 * DK);
  assert.strictEqual(y.lastAlarmMs, null);
  assert.notStrictEqual(y.startMs, s.startMs);
});

// ── mesaj ──
test('hyperfocusMessage sureyi icerir ve suclayici dil kullanmaz', () => {
  const m = H.hyperfocusMessage(90);
  assert.match(m, /90/);
  for (const kotu of ['çok fazla', 'aşırı', 'hâlâ']) {
    assert.ok(!m.toLowerCase().includes(kotu), `mesajda "${kotu}" gecmemeli`);
  }
});

test('hyperfocusMessage saat esiginde saat dilini kullanir', () => {
  assert.match(H.hyperfocusMessage(120), /2 saat/);
});
