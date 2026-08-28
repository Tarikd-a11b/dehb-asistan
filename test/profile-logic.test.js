const { test } = require('node:test');
const assert = require('node:assert');
const P = require('../profile-logic.js');

// ── clampLevel ──
test('clampLevel 1-5 araligina kirpar', () => {
  assert.strictEqual(P.clampLevel(0), 1);
  assert.strictEqual(P.clampLevel(9), 5);
  assert.strictEqual(P.clampLevel(3), 3);
});

test('clampLevel metin sayiyi kabul eder, cop degerde varsayilana duser', () => {
  assert.strictEqual(P.clampLevel('4'), 4);
  assert.strictEqual(P.clampLevel('abc'), 2);
  assert.strictEqual(P.clampLevel(null, 5), 5);
  assert.strictEqual(P.clampLevel(undefined, 1), 1);
});

test('clampLevel ondaligi yuvarlar', () => {
  assert.strictEqual(P.clampLevel(3.6), 4);
});

// ── normalizeSuperpowers ──
test('normalizeSuperpowers taninmayan id atar', () => {
  assert.deepStrictEqual(P.normalizeSuperpowers(['hyperfocus', 'uydurma']), ['hyperfocus']);
});

test('normalizeSuperpowers JSONB metin halini de cozer', () => {
  assert.deepStrictEqual(P.normalizeSuperpowers('["creativity","humor"]'), ['creativity', 'humor']);
});

test('normalizeSuperpowers bozuk girdide bos dizi doner', () => {
  assert.deepStrictEqual(P.normalizeSuperpowers('{bozuk'), []);
  assert.deepStrictEqual(P.normalizeSuperpowers(null), []);
  assert.deepStrictEqual(P.normalizeSuperpowers(42), []);
});

// ── rowToProfile ──
test('rowToProfile bos satirda tam varsayilan profil uretir', () => {
  const p = P.rowToProfile({});
  assert.deepStrictEqual(p, { ...P.DEFAULT_PROFILE });
});

test('rowToProfile null satiri da kaldirir', () => {
  assert.strictEqual(P.rowToProfile(null).focusPeriod, 25);
});

test('rowToProfile snake_case kolonlari camelCase alanlara tasir', () => {
  const p = P.rowToProfile({
    focus_period: 50, work_start: '10:00', work_end: '19:00',
    energy_peak: 'night',
    superpowers: ['hyperfocus']
  });
  assert.strictEqual(p.focusPeriod, 50);
  assert.deepStrictEqual(p.workHours, { start: '10:00', end: '19:00' });
  assert.strictEqual(p.energyPeak, 'night');
  assert.deepStrictEqual(p.superpowers, ['hyperfocus']);
});

test('rowToProfile 0 ve bos string degerlerini varsayilana kacirmaz', () => {
  // ?? kullanildigi icin 0 korunmali; || olsaydi varsayilana donerdi.
  const p = P.rowToProfile({ focus_period: 0, motivation_note: '' });
  assert.strictEqual(p.focusPeriod, 0);
  assert.strictEqual(p.motivationNote, '');
});

// ── profileToRow ──
test('profileToRow tum kolonlari doldurur, undefined birakmaz', () => {
  const row = P.profileToRow({}, { id: 'u1', email: 'a@b.c' });
  const beklenen = ['id', 'email', 'focus_period', 'work_start', 'work_end', 'energy_peak',
    'social', 'focus_trigger', 'motivation_note', 'main_obstacle',
    'break_style', 'today_mood', 'today_mood_date', 'hyperfocus_limit', 'light_sensitivity',
    'superpowers'];
  assert.deepStrictEqual(Object.keys(row).sort(), beklenen.sort());
  for (const [k, v] of Object.entries(row)) {
    assert.notStrictEqual(v, undefined, `${k} undefined olmamali`);
  }
});

test('profileToRow eksik workHours ile patlamaz', () => {
  const row = P.profileToRow({ workHours: undefined }, { id: 'u1' });
  assert.strictEqual(row.work_start, '09:00');
  assert.strictEqual(row.work_end, '18:00');
});

test('profileToRow gidis-donus profili korur', () => {
  const orijinal = P.mergeProfile(P.DEFAULT_PROFILE, {
    focusPeriod: 45, energyPeak: 'night', lightSensitivity: 5,
    superpowers: ['humor', 'energy']
  });
  const geri = P.rowToProfile(P.profileToRow(orijinal, { id: 'u1', email: 'a@b.c' }));
  assert.deepStrictEqual(geri, orijinal);
});

// ── mergeProfile: veri kaybi hatasinin testi ──
test('mergeProfile yamada olmayan alani DUSURMEZ', () => {
  const mevcut = { ...P.DEFAULT_PROFILE, lightSensitivity: 5, superpowers: ['humor'] };
  const sonuc = P.mergeProfile(mevcut, { focusPeriod: 40 });
  assert.strictEqual(sonuc.lightSensitivity, 5, 'lightSensitivity silinmemeli');
  assert.deepStrictEqual(sonuc.superpowers, ['humor']);
  assert.strictEqual(sonuc.focusPeriod, 40);
});

test('mergeProfile undefined yamayi yok sayar', () => {
  const sonuc = P.mergeProfile({ ...P.DEFAULT_PROFILE, focusTrigger: 'music' }, { focusTrigger: undefined });
  assert.strictEqual(sonuc.focusTrigger, 'music');
});

test('mergeProfile bos string ve 0 yamayi UYGULAR', () => {
  // undefined atlanir ama kullanicinin bilerek bosalttigi alan yazilmali.
  const sonuc = P.mergeProfile({ ...P.DEFAULT_PROFILE, motivationNote: 'oyun', focusPeriod: 25 },
                               { motivationNote: '', focusPeriod: 0 });
  assert.strictEqual(sonuc.motivationNote, '');
  assert.strictEqual(sonuc.focusPeriod, 0);
});

test('mergeProfile workHours icin parcali birlestirme yapar', () => {
  const sonuc = P.mergeProfile({ ...P.DEFAULT_PROFILE, workHours: { start: '08:00', end: '17:00' } },
                               { workHours: { end: '20:00' } });
  assert.deepStrictEqual(sonuc.workHours, { start: '08:00', end: '20:00' });
});

test('mergeProfile undefined workHours alt anahtarini varsayilana DUSURMEZ', () => {
  // Form alani yoksa sg() undefined doner; kullanicinin mesaisi korunmali.
  const sonuc = P.mergeProfile({ ...P.DEFAULT_PROFILE, workHours: { start: '07:30', end: '16:00' } },
                               { workHours: { start: undefined, end: undefined } });
  assert.deepStrictEqual(sonuc.workHours, { start: '07:30', end: '16:00' });
});

test('mergeProfile bos mevcut profilde varsayilanla baslar', () => {
  const sonuc = P.mergeProfile(null, { focusPeriod: 30 });
  assert.strictEqual(sonuc.focusPeriod, 30);
  assert.strictEqual(sonuc.breakStyle, 'pomodoro');
  assert.deepStrictEqual(sonuc.workHours, { start: '09:00', end: '18:00' });
});

test('mergeProfile girdiyi degistirmez', () => {
  const mevcut = { ...P.DEFAULT_PROFILE, focusPeriod: 25 };
  P.mergeProfile(mevcut, { focusPeriod: 60 });
  assert.strictEqual(mevcut.focusPeriod, 25);
});

// ── toggleSuperpower ──
test('toggleSuperpower ekler ve cikarir', () => {
  assert.deepStrictEqual(P.toggleSuperpower([], 'humor'), ['humor']);
  assert.deepStrictEqual(P.toggleSuperpower(['humor'], 'humor'), []);
});

test('toggleSuperpower bilinmeyen id eklemez', () => {
  assert.deepStrictEqual(P.toggleSuperpower(['humor'], 'uydurma'), ['humor']);
});

test('toggleSuperpower girdiyi degistirmez', () => {
  const liste = ['humor'];
  P.toggleSuperpower(liste, 'energy');
  assert.deepStrictEqual(liste, ['humor']);
});

// ── planningProfile ──
test('planningProfile bos profilde bile hicbir alani undefined birakmaz', () => {
  const gonderilen = P.planningProfile({});
  for (const [k, v] of Object.entries(gonderilen)) {
    assert.notStrictEqual(v, undefined, `${k} undefined olmamali`);
  }
  assert.strictEqual(gonderilen.focusPeriod, 25);
  assert.deepStrictEqual(gonderilen.workHours, { start: '09:00', end: '18:00' });
});

test('planningProfile daha once tasinmayan alanlari da tasir', () => {
  const g = P.planningProfile({ ...P.DEFAULT_PROFILE, focusTrigger: 'lofi', social: 'cafe',
    hyperfocusLimit: '90', todayMood: 'foggy', motivationNote: 'oyun' });
  assert.strictEqual(g.focusTrigger, 'lofi');
  assert.strictEqual(g.social, 'cafe');
  assert.strictEqual(g.hyperfocusLimit, '90');
  assert.strictEqual(g.todayMood, 'foggy');
  assert.strictEqual(g.motivationNote, 'oyun');
});

test('planningProfile metin focusPeriod degerini sayiya cevirir', () => {
  assert.strictEqual(P.planningProfile({ focusPeriod: '45' }).focusPeriod, 45);
  assert.strictEqual(P.planningProfile({ focusPeriod: 'abc' }).focusPeriod, 25);
});

test('planningProfile google/supabase token gibi alanlari sizdirmaz', () => {
  const g = P.planningProfile({ ...P.DEFAULT_PROFILE, google_refresh_token: 'GIZLI', email: 'a@b.c' });
  assert.strictEqual(g.google_refresh_token, undefined);
  assert.strictEqual(g.email, undefined);
});

// ── tema koprusu ──
test('themeIsDark esik degerinde koyu temaya gecer', () => {
  assert.strictEqual(P.themeIsDark(2), false);
  assert.strictEqual(P.themeIsDark(3), true);
  assert.strictEqual(P.themeIsDark(5), true);
});

test('lightSensitivityForTheme ile themeIsDark birbirini tutar', () => {
  assert.strictEqual(P.themeIsDark(P.lightSensitivityForTheme(true)), true);
  assert.strictEqual(P.themeIsDark(P.lightSensitivityForTheme(false)), false);
});

// ── profileCompleteness ──
test('profileCompleteness dokunulmamis profilde 0 doner', () => {
  assert.strictEqual(P.profileCompleteness(P.DEFAULT_PROFILE), 0);
  assert.strictEqual(P.profileCompleteness({}), 0);
});

test('profileCompleteness doldurdukca artar', () => {
  const az = P.profileCompleteness({ ...P.DEFAULT_PROFILE, focusPeriod: 45 });
  const cok = P.profileCompleteness({ ...P.DEFAULT_PROFILE, focusPeriod: 45,
    focusTrigger: 'lofi', superpowers: ['humor'], motivationNote: 'oyun' });
  assert.ok(az > 0 && az < cok, `az=${az} cok=${cok}`);
  assert.ok(cok <= 100);
});

test('profileCompleteness bos motivasyon notunu dolu saymaz', () => {
  assert.strictEqual(P.profileCompleteness({ ...P.DEFAULT_PROFILE, motivationNote: '   ' }), 0);
});

// ── moodForToday ──
test('moodForToday bugunun modunu aynen dondurur', () => {
  assert.strictEqual(P.moodForToday('foggy', '2026-08-28', '2026-08-28'), 'foggy');
});

test('moodForToday dunun modunu bos dondurur', () => {
  assert.strictEqual(P.moodForToday('foggy', '2026-08-27', '2026-08-28'), '');
});

test('moodForToday tarihsiz modu BAYAT sayar', () => {
  // Kolon eklenmeden once kaydedilmis satirlarin hepsi tarihsiz; bunlari
  // "bugunku" saymak tam da duzeltmeye calistigimiz hatayi surdururdu.
  assert.strictEqual(P.moodForToday('foggy', null, '2026-08-28'), '');
  assert.strictEqual(P.moodForToday('foggy', undefined, '2026-08-28'), '');
  assert.strictEqual(P.moodForToday('foggy', '', '2026-08-28'), '');
});

test('moodForToday bos modda tarih bugun olsa bile bos doner', () => {
  assert.strictEqual(P.moodForToday('', '2026-08-28', '2026-08-28'), '');
  assert.strictEqual(P.moodForToday(null, '2026-08-28', '2026-08-28'), '');
});

test('moodForToday bugun bilinmiyorsa bayat sayar', () => {
  assert.strictEqual(P.moodForToday('foggy', '2026-08-28', ''), '');
});

// ── todayMoodDate ──
test('DEFAULT_PROFILE todayMoodDate tasir ve bos baslar', () => {
  assert.strictEqual(P.DEFAULT_PROFILE.todayMoodDate, '');
});

test('rowToProfile today_mood_date kolonunu okur', () => {
  const p = P.rowToProfile({ today_mood: 'hyper', today_mood_date: '2026-08-28' });
  assert.strictEqual(p.todayMood, 'hyper');
  assert.strictEqual(p.todayMoodDate, '2026-08-28');
});

test('profileToRow today_mood_date kolonunu yazar', () => {
  const row = P.profileToRow({ ...P.DEFAULT_PROFILE, todayMood: 'crash', todayMoodDate: '2026-08-28' },
                             { id: 'u1', email: 'a@b.c' });
  assert.strictEqual(row.today_mood_date, '2026-08-28');
});

test('profileCompleteness todayMood ile degismez', () => {
  // Doluluk "profilini ne kadar tanittin" demek; gunluk degisen bir cevap
  // oraya ait degil. todayMood gunluk sifirlandigi icin hesapta kalsaydi
  // cubuk her sabah bir puan geri giderdi.
  const a = P.profileCompleteness({ ...P.DEFAULT_PROFILE, todayMood: '' });
  const b = P.profileCompleteness({ ...P.DEFAULT_PROFILE, todayMood: 'focused' });
  assert.strictEqual(a, b);
});

// ── medication kaldirildi (2026-08-28) ──
test('DEFAULT_PROFILE medication tasimaz', () => {
  assert.ok(!('medication' in P.DEFAULT_PROFILE));
});

test('planningProfile ve profileToRow medication gondermez', () => {
  assert.ok(!('medication' in P.planningProfile({ medication: true })));
  assert.ok(!('medication' in P.profileToRow(P.DEFAULT_PROFILE, { id: 'u1', email: 'a@b.c' })));
});

// ── Duyusal Profil karti kaldirildi (2026-08-28) ──
test('DEFAULT_PROFILE duyusal alanlari tasimaz ama lightSensitivity durur', () => {
  for (const k of ['soundSensitivity', 'envPref', 'stimPref']) {
    assert.ok(!(k in P.DEFAULT_PROFILE), k + ' hala var');
  }
  assert.strictEqual(P.DEFAULT_PROFILE.lightSensitivity, 2);
});

test('koyu tema koprusu bozulmadi', () => {
  assert.strictEqual(P.themeIsDark(4), true);
  assert.strictEqual(P.themeIsDark(1), false);
  assert.strictEqual(P.lightSensitivityForTheme(true), 4);
});

// ── Duygu Regulasyonu karti kaldirildi (2026-08-28) ──
test('DEFAULT_PROFILE rsdLevel ve regulationMethod tasimaz', () => {
  assert.ok(!('rsdLevel' in P.DEFAULT_PROFILE));
  assert.ok(!('regulationMethod' in P.DEFAULT_PROFILE));
});

test('planningProfile rsdLevel ve regulationMethod gondermez', () => {
  const p = P.planningProfile({ rsdLevel: 5, regulationMethod: 'movement' });
  assert.ok(!('rsdLevel' in p));
  assert.ok(!('regulationMethod' in p));
});
