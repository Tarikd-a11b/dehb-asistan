const { test } = require('node:test');
const assert = require('node:assert');
const A = require('../analysis-logic.js');

const DK = 60000;
const T0 = Date.UTC(2026, 9, 12, 7, 0, 0);          // 10:00 İstanbul
const iso = (ms) => new Date(ms).toISOString();
const gorev = (ek = {}) => ({
  id: 't1', cognitive_load: 'high',
  start_time: iso(T0), end_time: iso(T0 + 25 * DK), ...ek
});

// ── analysisPlannedMinutes ──
test('planlanan sure start/end farkidir', () => {
  assert.strictEqual(A.analysisPlannedMinutes(gorev()), 25);
});
test('start/end bozuksa planlanan sure null', () => {
  assert.strictEqual(A.analysisPlannedMinutes(gorev({ end_time: null })), null);
  assert.strictEqual(A.analysisPlannedMinutes(gorev({ end_time: iso(T0 - DK) })), null);
});

// ── analysisTimerStart ──
test('ilk baslatma started_at ve running_since yazar', () => {
  assert.deepStrictEqual(A.analysisTimerStart(gorev(), T0),
    { started_at: iso(T0), running_since: iso(T0) });
});
test('devam ettirme started_at e dokunmaz', () => {
  const t = gorev({ started_at: iso(T0), active_seconds: 300 });
  assert.deepStrictEqual(A.analysisTimerStart(t, T0 + 10 * DK), { running_since: iso(T0 + 10 * DK) });
});
test('zaten calisiyorsa baslatma bos yama doner (iki sekme)', () => {
  const t = gorev({ started_at: iso(T0), running_since: iso(T0) });
  assert.deepStrictEqual(A.analysisTimerStart(t, T0 + DK), {});
});

// ── analysisTimerPause / analysisActiveSeconds ──
test('duraklatma dilimi toplar ve en uzun dilimi gunceller', () => {
  const t = gorev({ started_at: iso(T0), running_since: iso(T0), active_seconds: 0 });
  assert.deepStrictEqual(A.analysisTimerPause(t, T0 + 12 * DK),
    { running_since: null, active_seconds: 720, longest_stretch_sec: 720 });
});
test('kisa ikinci dilim en uzun dilimi dusurmez', () => {
  const t = gorev({ started_at: iso(T0), running_since: iso(T0 + 30 * DK),
                    active_seconds: 720, longest_stretch_sec: 720 });
  assert.deepStrictEqual(A.analysisTimerPause(t, T0 + 35 * DK),
    { running_since: null, active_seconds: 1020, longest_stretch_sec: 720 });
});
test('calismayan sayaci duraklatmak bos yama', () => {
  assert.deepStrictEqual(A.analysisTimerPause(gorev({ active_seconds: 60 }), T0), {});
});
test('aktif saniye calisan dilimi de sayar', () => {
  const t = gorev({ running_since: iso(T0), active_seconds: 60 });
  assert.strictEqual(A.analysisActiveSeconds(t, T0 + 2 * DK), 180);
  assert.strictEqual(A.analysisActiveSeconds(gorev(), T0), 0);
});
test('saat geri giderse dilim negatif olmaz', () => {
  const t = gorev({ running_since: iso(T0 + DK), active_seconds: 60 });
  assert.strictEqual(A.analysisActiveSeconds(t, T0), 60);
});

// ── analysisCompletionPatch ──
test('sayac kullanildiysa gercek sure yazilir, soru yok', () => {
  const t = gorev({ started_at: iso(T0), running_since: iso(T0), active_seconds: 0 });
  const r = A.analysisCompletionPatch(t, T0 + 40 * DK);
  assert.strictEqual(r.needsFeedback, false);
  assert.deepStrictEqual(r.patch, {
    running_since: null, active_seconds: 2400, longest_stretch_sec: 2400,
    actual_minutes: 40, completed_at: iso(T0 + 40 * DK)
  });
});
test('duraklatilmis sayacla tamamlama da gercek sure yazar', () => {
  const t = gorev({ started_at: iso(T0), active_seconds: 1500, longest_stretch_sec: 900 });
  const r = A.analysisCompletionPatch(t, T0 + 90 * DK);
  assert.strictEqual(r.needsFeedback, false);
  assert.strictEqual(r.patch.actual_minutes, 25);
  assert.strictEqual(r.patch.completed_at, iso(T0 + 90 * DK));
});
test('sayac kullanilmadiysa soru sorulur', () => {
  const r = A.analysisCompletionPatch(gorev(), T0 + 30 * DK);
  assert.strictEqual(r.needsFeedback, true);
  assert.deepStrictEqual(r.patch, { completed_at: iso(T0 + 30 * DK) });
});
test('planlananin 3 katini asan sayac unutulmus sayilir', () => {
  const t = gorev({ started_at: iso(T0), running_since: iso(T0), active_seconds: 0 });
  const r = A.analysisCompletionPatch(t, T0 + 76 * DK);   // 25*3 = 75
  assert.strictEqual(r.needsFeedback, true);
  assert.strictEqual(r.patch.actual_minutes, null);
});
test('240 dakikayi asan sayac unutulmus sayilir (uzun gorevde de)', () => {
  const t = gorev({ end_time: iso(T0 + 120 * DK), started_at: iso(T0),
                    running_since: iso(T0), active_seconds: 0 });
  const r = A.analysisCompletionPatch(t, T0 + 241 * DK);
  assert.strictEqual(r.needsFeedback, true);
  assert.strictEqual(r.patch.actual_minutes, null);
});
test('2 dakikadan kisa olcum olculmemis sayilir: actual_minutes null, soru sorulur', () => {
  // Yanlislikla Baslat -> Tamamla: saniyeler agirlik-1 ornek olmasin (I3).
  const t = gorev({ started_at: iso(T0), running_since: iso(T0), active_seconds: 0 });
  const r = A.analysisCompletionPatch(t, T0 + 20000);
  assert.strictEqual(r.patch.actual_minutes, null);
  assert.strictEqual(r.needsFeedback, true);
  assert.strictEqual(r.patch.running_since, null);
  assert.strictEqual(A.analysisCompletionPatch(t, T0 + 2 * DK - 1000).patch.actual_minutes, null);
});
test('tam 2 dakikalik olcum yazilir (sinir)', () => {
  const t = gorev({ started_at: iso(T0), running_since: iso(T0), active_seconds: 0 });
  const r = A.analysisCompletionPatch(t, T0 + 2 * DK);
  assert.strictEqual(r.patch.actual_minutes, 2);
  assert.strictEqual(r.needsFeedback, false);
  assert.strictEqual(A.ANALYSIS_MIN_MEASURED_MIN, 2);
});
test('tamamlamayi geri alma yamasi', () => {
  assert.deepStrictEqual(A.analysisUncompletePatch(),
    { completed_at: null, actual_minutes: null, duration_feedback: null });
});
test('yamalar girdiyi degistirmez', () => {
  const t = gorev({ started_at: iso(T0), running_since: iso(T0), active_seconds: 0 });
  const kopya = JSON.stringify(t);
  A.analysisTimerPause(t, T0 + DK); A.analysisCompletionPatch(t, T0 + DK);
  assert.strictEqual(JSON.stringify(t), kopya);
});

// ═════ Analiz ═════
const GUN = 86400000;
const bitmis = (ek = {}) => gorev({ completed_at: iso(T0), ...ek });
const zamanli = (dakika, yuk = 'high', gunOnce = 0, dilimDk = dakika) => bitmis({
  cognitive_load: yuk, started_at: iso(T0 - gunOnce * GUN),
  actual_minutes: dakika, longest_stretch_sec: dilimDk * 60,
  completed_at: iso(T0 - gunOnce * GUN)
});

// ── analysisSample ──
test('zamanli ornek tam agirlik, oran gercek/planlanan', () => {
  assert.deepStrictEqual(A.analysisSample(zamanli(40)), { load: 'high', ratio: 1.6, weight: 1 });
});
test('soru cevabi yarim agirlik', () => {
  assert.deepStrictEqual(A.analysisSample(bitmis({ duration_feedback: 'longer' })),
    { load: 'high', ratio: 1.4, weight: 0.5 });
  assert.deepStrictEqual(A.analysisSample(bitmis({ duration_feedback: 'shorter', cognitive_load: 'low' })),
    { load: 'low', ratio: 0.75, weight: 0.5 });
});
test('ornek orani planned_factor ile carpilir (carpan kendini beslemesin, C2)', () => {
  // Blok zaten 1.6 ile uzatilmis (25 -> 40 dk) ve 40 dk surdu: gercek oran hala 1.6.
  const blok40 = (ek) => bitmis({ cognitive_load: 'high', end_time: iso(T0 + 40 * DK), ...ek });
  assert.deepStrictEqual(A.analysisSample(blok40({ actual_minutes: 40, planned_factor: 1.6 })),
    { load: 'high', ratio: 1.6, weight: 1 });
  assert.deepStrictEqual(A.analysisSample(blok40({ duration_feedback: 'same', planned_factor: 1.6 })),
    { load: 'high', ratio: 1.6, weight: 0.5 });
  // Supabase NUMERIC'i metin olarak dondurebilir
  assert.strictEqual(A.analysisSample(blok40({ actual_minutes: 40, planned_factor: '1.6' })).ratio, 1.6);
  // null / 0 / bozuk -> 1 (tek "Ekle" yolu planned_factor yazmaz)
  assert.strictEqual(A.analysisSample(blok40({ actual_minutes: 40, planned_factor: null })).ratio, 1);
  assert.strictEqual(A.analysisSample(blok40({ actual_minutes: 40, planned_factor: 0 })).ratio, 1);
  assert.strictEqual(A.analysisSample(blok40({ duration_feedback: 'longer', planned_factor: 'x' })).ratio, 1.4);
  assert.strictEqual(A.analysisSample(zamanli(40)).ratio, 1.6);
});
test('ne olcum ne cevap varsa ornek yok; bilinmeyen yuk medium sayilir', () => {
  assert.strictEqual(A.analysisSample(bitmis()), null);
  assert.strictEqual(A.analysisSample(zamanli(30, 'xyz')).load, 'medium');
  assert.strictEqual(A.analysisSample(bitmis({ end_time: null, actual_minutes: 30 })), null);
});

// ── analysisFactors ──
test('ornek yoksa oranlar 1.0', () => {
  assert.deepStrictEqual(A.analysisFactors([], T0),
    { factors: { low: 1, medium: 1, high: 1 }, samples: { low: 0, medium: 0, high: 0 } });
});
test('yumusatma: 5 adet 1.6 -> (5*1.6+5)/10 = 1.3', () => {
  const r = A.analysisFactors(Array.from({ length: 5 }, () => zamanli(40)), T0);
  assert.strictEqual(r.factors.high, 1.3);
  assert.strictEqual(r.samples.high, 5);
  assert.strictEqual(r.factors.low, 1);
});
test('30 gunden eski ornek sayilmaz', () => {
  const r = A.analysisFactors([zamanli(40, 'high', 31)], T0);
  assert.strictEqual(r.samples.high, 0);
});
test('oran 0.6-2.5 araliginda tutulur', () => {
  const cok = Array.from({ length: 200 }, () => zamanli(74));   // 2.96
  assert.strictEqual(A.analysisFactors(cok, T0).factors.high, 2.5);
  const az = Array.from({ length: 200 }, () => zamanli(5));     // 0.2
  assert.strictEqual(A.analysisFactors(az, T0).factors.high, 0.6);
});

// ── analysisFocusSuggestion ──
const oturumlar = (n, dilimDk) => Array.from({ length: n }, (_, i) => zamanli(dilimDk, 'medium', i % 10, dilimDk));
test('8 oturumdan azsa oneri yok', () => {
  assert.deepStrictEqual(A.analysisFocusSuggestion(oturumlar(7, 40), T0, 25),
    { suggestion: null, timedSessions: 7 });
});
test('ortanca 5e yuvarlanir: 8 x 37 dk -> 35', () => {
  assert.strictEqual(A.analysisFocusSuggestion(oturumlar(8, 37), T0, 25).suggestion, 35);
});
test('fark 5 dkdan azsa oneri yok', () => {
  // 27 -> 25'e yuvarlanir, fark 0 (28 OLMAZ: 30'a yuvarlanir, fark tam 5 -> oneri cikar)
  assert.strictEqual(A.analysisFocusSuggestion(oturumlar(8, 27), T0, 25).suggestion, null);
  assert.strictEqual(A.analysisFocusSuggestion(oturumlar(8, 28), T0, 25).suggestion, 30);
});
test('oneri 10-60 araliginda', () => {
  assert.strictEqual(A.analysisFocusSuggestion(oturumlar(8, 95), T0, 25).suggestion, 60);
  assert.strictEqual(A.analysisFocusSuggestion(oturumlar(8, 3), T0, 25).suggestion, 10);
});
test('14 gunden eski oturum sayilmaz', () => {
  const eski = Array.from({ length: 8 }, () => zamanli(40, 'medium', 15));
  assert.strictEqual(A.analysisFocusSuggestion(eski, T0, 25).timedSessions, 0);
});
test('cift sayida ortanca iki ortanin ortalamasi', () => {
  const l = [...oturumlar(4, 30), ...oturumlar(4, 40)];   // ortanca 35
  assert.strictEqual(A.analysisFocusSuggestion(l, T0, 25).suggestion, 35);
});
test('unutulmus sayac (actual_minutes null) odak analizine girmez', () => {
  const unutulmus = Array.from({ length: 8 }, () => zamanli(40, 'medium', 0, 300));
  unutulmus.forEach(t => { t.actual_minutes = null; });
  assert.strictEqual(A.analysisFocusSuggestion(unutulmus, T0, 25).timedSessions, 0);
  assert.strictEqual(A.analysisDailyStretches(unutulmus, T0)[13].minutes, 0);
});

// ── analysisDailyStretches ──
test('14 gunluk dizi, gun basina en uzun dilim, bos gun 0', () => {
  const d = A.analysisDailyStretches([zamanli(20, 'low', 0, 20), zamanli(30, 'low', 0, 35), zamanli(10, 'low', 2, 10)], T0);
  assert.strictEqual(d.length, 14);
  assert.deepStrictEqual(d[13], { day: '2026-10-12', minutes: 35 });
  assert.deepStrictEqual(d[11], { day: '2026-10-10', minutes: 10 });
  assert.strictEqual(d[12].minutes, 0);
});

// ── analysisCalibration / parse / same ──
test('calibration sekli', () => {
  const c = A.analysisCalibration(oturumlar(8, 37), T0, 25);
  assert.deepStrictEqual(Object.keys(c).sort(),
    ['computedAt', 'factors', 'focusSuggestion', 'samples', 'timedSessions']);
  assert.strictEqual(c.computedAt, iso(T0));
  assert.strictEqual(c.focusSuggestion, 35);
  assert.strictEqual(c.timedSessions, 8);
});
test('bozuk calibration guvenli varsayilana doner', () => {
  const v = { computedAt: null, factors: { low: 1, medium: 1, high: 1 },
              samples: { low: 0, medium: 0, high: 0 }, focusSuggestion: null, timedSessions: 0 };
  for (const raw of [null, undefined, 'abc', '{bozuk', 42, { factors: 'x' }]) {
    assert.deepStrictEqual(A.analysisParseCalibration(raw), v, String(raw));
  }
});
test('parse JSON dizesini de kabul eder ve oranlari sinirlar', () => {
  const p = A.analysisParseCalibration(JSON.stringify({ factors: { high: 9 }, samples: { high: 3 } }));
  assert.strictEqual(p.factors.high, 2.5);
  assert.strictEqual(p.samples.high, 3);
});
test('ayni calibration karsilastirmasi computedAt i yok sayar', () => {
  const a = A.analysisCalibration(oturumlar(8, 37), T0, 25);
  const b = A.analysisCalibration(oturumlar(8, 37), T0 + GUN / 2, 25);
  assert.strictEqual(A.analysisSameCalibration(a, b), true);
  assert.strictEqual(A.analysisSameCalibration(a, { ...b, focusSuggestion: 40 }), false);
});

// ── analysisMailLine ──
test('mail satiri: en yuksek oran >=1.2 ve >=5 ornek', () => {
  const c = { factors: { low: 1.05, medium: 1.3, high: 1.6 }, samples: { low: 9, medium: 6, high: 5 } };
  assert.strictEqual(A.analysisMailLine(c),
    'Ağır görevlerin ortalama 1,6 kat sürdü — planlarını buna göre ayarlıyorum.');
});
test('yeterli ornegi olmayan seviye atlanir', () => {
  const c = { factors: { low: 1, medium: 1.3, high: 1.9 }, samples: { low: 0, medium: 6, high: 4 } };
  assert.match(A.analysisMailLine(c), /^Orta görevlerin ortalama 1,3 kat/);
});
test('kosul yoksa mail satiri bos', () => {
  assert.strictEqual(A.analysisMailLine(null), '');
  assert.strictEqual(A.analysisMailLine({ factors: { low: 1.1, medium: 1.1, high: 1.15 },
    samples: { low: 9, medium: 9, high: 9 } }), '');
});
