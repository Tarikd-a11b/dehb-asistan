const { test } = require('node:test');
const assert = require('node:assert');
const C = require('../calendar-logic.js');

// ── buildMonthGrid ──
test('buildMonthGrid 42 hucre dondurur', () => {
  assert.strictEqual(C.buildMonthGrid(2026, 7).length, 42);
});

test('buildMonthGrid ayin ilk gununu dogru sutuna yerlestirir', () => {
  // 1 Agustos 2026 Cumartesi (getDay() === 6) → ilk hucre 26 Temmuz Pazar
  const grid = C.buildMonthGrid(2026, 7);
  assert.strictEqual(grid[0].iso, '2026-07-26');
  assert.strictEqual(grid[0].inMonth, false);
  assert.strictEqual(grid[6].iso, '2026-08-01');
  assert.strictEqual(grid[6].inMonth, true);
});

test('buildMonthGrid ay sonu tasmasini isaretler', () => {
  const grid = C.buildMonthGrid(2026, 7);   // Agustos 2026, 31 gun
  const sonGun = grid.find(c => c.iso === '2026-08-31');
  assert.strictEqual(sonGun.inMonth, true);
  const sonraki = grid.find(c => c.iso === '2026-09-01');
  assert.strictEqual(sonraki.inMonth, false);
});

test('buildMonthGrid artik yilda 29 Subati icerir', () => {
  const grid = C.buildMonthGrid(2028, 1);   // Subat 2028 artik yil
  const artikGun = grid.find(c => c.iso === '2028-02-29');
  assert.ok(artikGun, '29 Subat 2028 izgarada bulunmali');
  assert.strictEqual(artikGun.inMonth, true);
});

test('buildMonthGrid artik olmayan yilda 29 Subat icermez', () => {
  const grid = C.buildMonthGrid(2027, 1);
  assert.strictEqual(grid.find(c => c.iso === '2027-02-29'), undefined);
});

test('buildMonthGrid UTC kaymasi yapmaz', () => {
  // toISOString() kullanilsaydi UTC+3'te her hucre bir gun geri kayardi.
  const grid = C.buildMonthGrid(2026, 0);
  assert.strictEqual(grid.find(c => c.day === 1 && c.inMonth).iso, '2026-01-01');
});

// ── monthLabel ──
test('monthLabel turkce ay adi verir', () => {
  assert.strictEqual(C.monthLabel(2026, 7), 'Ağustos 2026');
  assert.strictEqual(C.monthLabel(2026, 0), 'Ocak 2026');
  assert.strictEqual(C.monthLabel(2026, 11), 'Aralık 2026');
});

// ── shiftMonth ──
test('shiftMonth yil sinirini asar', () => {
  assert.deepStrictEqual(C.shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepStrictEqual(C.shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepStrictEqual(C.shiftMonth(2026, 7, 1), { year: 2026, month: 8 });
});

// ── weekRangeISO ──
test('weekRangeISO pazar-cumartesi araligini verir', () => {
  // 26 Agustos 2026 Carsamba → hafta 23 Agustos Pazar - 29 Agustos Cumartesi
  assert.deepStrictEqual(C.weekRangeISO('2026-08-26'), { start: '2026-08-23', end: '2026-08-29' });
});

test('weekRangeISO pazar gunu verilince o gunu baslangic sayar', () => {
  assert.deepStrictEqual(C.weekRangeISO('2026-08-23'), { start: '2026-08-23', end: '2026-08-29' });
});

test('weekRangeISO ay sinirini asan haftayi dogru verir', () => {
  // 1 Eylul 2026 Sali → hafta 30 Agustos Pazar - 5 Eylul Cumartesi
  assert.deepStrictEqual(C.weekRangeISO('2026-09-01'), { start: '2026-08-30', end: '2026-09-05' });
});

// ── isPastDay ──
test('isPastDay dunu gecmis sayar', () => {
  assert.strictEqual(C.isPastDay('2026-08-22', '2026-08-23'), true);
});

test('isPastDay BUGUNU gecmis SAYMAZ', () => {
  // Bugune gorev eklenebilmeli; sinir hatasi burada olur.
  assert.strictEqual(C.isPastDay('2026-08-23', '2026-08-23'), false);
});

test('isPastDay yarini gecmis saymaz', () => {
  assert.strictEqual(C.isPastDay('2026-08-24', '2026-08-23'), false);
});

test('isPastDay ay sinirini dogru asar', () => {
  // Sozluk sirasi kronolojik sirayla ayni mi: 31 Agustos < 1 Eylul
  assert.strictEqual(C.isPastDay('2026-08-31', '2026-09-01'), true);
  assert.strictEqual(C.isPastDay('2026-09-01', '2026-08-31'), false);
});

test('isPastDay yil sinirini dogru asar', () => {
  assert.strictEqual(C.isPastDay('2025-12-31', '2026-01-01'), true);
  assert.strictEqual(C.isPastDay('2026-01-01', '2025-12-31'), false);
});

test('isPastDay tek haneli ay/gunde de dogru siralar', () => {
  // Sifir dolgu olmasaydi '2026-9-01' < '2026-10-01' string olarak YANLIS cikardi.
  // localDayISO/_iso her zaman dolguladigi icin bu format garanti.
  assert.strictEqual(C.isPastDay('2026-09-05', '2026-10-01'), true);
  assert.strictEqual(C.isPastDay('2026-10-01', '2026-09-05'), false);
});

// ── isBusyDay ──
test('isBusyDay esigin altinda false, esikte ve ustunde true', () => {
  assert.strictEqual(C.YOGUN_GUN_ESIGI, 5);
  assert.strictEqual(C.isBusyDay(4), false);
  assert.strictEqual(C.isBusyDay(5), true);
  assert.strictEqual(C.isBusyDay(9), true);
});

test('isBusyDay 0/undefined/null ile patlamaz', () => {
  assert.strictEqual(C.isBusyDay(0), false);
  assert.strictEqual(C.isBusyDay(undefined), false);
  assert.strictEqual(C.isBusyDay(null), false);
});

// ── cardLayout ──
test('cardLayout satir sayisini sureye gore secer', () => {
  assert.strictEqual(C.cardLayout(30).satir, 1);
  assert.strictEqual(C.cardLayout(59).satir, 1);
  assert.strictEqual(C.cardLayout(60).satir, 2);
  assert.strictEqual(C.cardLayout(89).satir, 2);
  assert.strictEqual(C.cardLayout(90).satir, 3);
  assert.strictEqual(C.cardLayout(240).satir, 3);
});

test('cardLayout saati yalnizca 45dk ve uzerinde gosterir', () => {
  // 45dk'nin altinda saat + baslik birlikte kutuya sigmiyor, saat gizleniyor.
  assert.strictEqual(C.cardLayout(44).saatGoster, false);
  assert.strictEqual(C.cardLayout(45).saatGoster, true);
});

test('cardLayout kisa kart esigi 30dk, esikte kapali', () => {
  assert.strictEqual(C.KISA_OLAY_DK, 30);
  assert.strictEqual(C.cardLayout(20).kisa, true);
  assert.strictEqual(C.cardLayout(29).kisa, true);
  assert.strictEqual(C.cardLayout(30).kisa, false);
});

test('cardLayout sure bilinmiyorsa (0/negatif) tek satira duser, kisa DEGILDIR', () => {
  // Bitisi olmayan etkinlikte dakika 0 gelir; kenarligi kaldirmak icin sebep yok.
  for (const dk of [0, -5, undefined, null, NaN]) {
    const k = C.cardLayout(dk);
    assert.strictEqual(k.satir, 1, `satir ${dk}`);
    assert.strictEqual(k.kisa, false, `kisa ${dk}`);
    assert.strictEqual(k.saatGoster, false, `saat ${dk}`);
  }
});

// ── heightForView ──
test('heightForView hafta 700, digerleri auto', () => {
  assert.strictEqual(C.heightForView('timeGridWeek'), 700);
  assert.strictEqual(C.heightForView('dayGridMonth'), 'auto');
  assert.strictEqual(C.heightForView('timeGridDay'), 'auto');
});

// ── buildTaskRow ──
// NOT: testler saat dilimi BAGIMSIZ. Beklenen ISO metnini yazmak yerine
// start_time'i geri cozup yerel saatini kontrol ediyoruz — CI'da baska bir
// dilimde kosarsa da gecerli kalir.
test('buildTaskRow yerel saatleri UTC ISO olarak yazar, day yerel kalir', () => {
  const r = C.buildTaskRow({ dayISO: '2026-08-27', start: '20:00', end: '21:30',
                             title: '  Rapor taslagi  ', summary: '  notlar  ' });
  assert.strictEqual(r.day, '2026-08-27');
  assert.strictEqual(r.name, 'Rapor taslagi');       // basi/sonu kirpilir
  assert.strictEqual(r.summary, 'notlar');
  const bas = new Date(r.start_time), bit = new Date(r.end_time);
  assert.strictEqual(bas.getHours(), 20);
  assert.strictEqual(bas.getMinutes(), 0);
  assert.strictEqual(bas.getDate(), 27);
  assert.strictEqual((bit - bas) / 60000, 90);
  assert.ok(r.start_time.endsWith('Z'), 'UTC ISO bekleniyor');
});

test('buildTaskRow varsayilanlari: orta bilissel yuk, tamamlanmamis', () => {
  const r = C.buildTaskRow({ dayISO: '2026-08-27', start: '09:00', end: '09:25', title: 'X' });
  assert.strictEqual(r.cognitive_load, 'medium');
  assert.strictEqual(r.completed, false);
  assert.strictEqual(r.summary, null);   // bos aciklama null olur, '' degil
});

test('buildTaskRow bitis baslangictan sonra degilse null doner', () => {
  const ortak = { dayISO: '2026-08-27', title: 'X' };
  assert.strictEqual(C.buildTaskRow({ ...ortak, start: '10:00', end: '09:00' }), null);
  assert.strictEqual(C.buildTaskRow({ ...ortak, start: '10:00', end: '10:00' }), null);
  assert.ok(C.buildTaskRow({ ...ortak, start: '10:00', end: '10:01' }));
});

test('buildTaskRow eksik alanda null doner, patlamaz', () => {
  assert.strictEqual(C.buildTaskRow(), null);
  assert.strictEqual(C.buildTaskRow({}), null);
  assert.strictEqual(C.buildTaskRow({ dayISO: '2026-08-27', start: '10:00', end: '11:00', title: '   ' }), null);
  assert.strictEqual(C.buildTaskRow({ dayISO: '', start: '10:00', end: '11:00', title: 'X' }), null);
  assert.strictEqual(C.buildTaskRow({ dayISO: 'gecersiz', start: '10:00', end: '11:00', title: 'X' }), null);
});
