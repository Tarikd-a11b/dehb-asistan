# Çalışma Analizi ve Süre Kalibrasyonu — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Görevlerin gerçek süresini mevcut görev sayacından (ya da tek dokunuşluk sorudan) yakalamak, bundan zorluk bazlı tahmin oranı + odak süresi önerisi çıkarmak, oranı n8n yerleştiricisinde kullanmak, sonucu Profil'de sakin bir görsel kartta ve haftalık mailde göstermek.

**Architecture:** Hesap tamamen tarayıcıda, saf mantık dosyası `analysis-logic.js`'te (DOM/ağ/`Date.now()` yok). Sonuç `profiles.calibration` (jsonb) alanına yazılır; n8n yalnız okur — yerleştirme için istek gövdesindeki `userProfile.durationFactors`'tan, rapor için Supabase'ten. Mevcut donut sayaç (`TaskTimerState`, `tasks-view.js`) ölçüm kaynağı olur.

**Tech Stack:** Vanilla JS (klasik `<script>`, build yok), Tailwind (derlenmiş), Supabase (Postgres + RLS), n8n Code node'ları, `node --test`, playwright-core (`test-ui/`).

**Spec:** `docs/superpowers/specs/2026-10-12-calisma-analizi-kalibrasyon-design.md`

## Global Constraints

- **Çalışma dizini:** `C:\Users\dmrta\Desktop\Projeler\FocusAid\DehbProject\FocusAid`. Her görevin ilk adımı: `cd` + `git branch --show-current` ile `calisma-analizi` dalında olduğunu doğrula (yoksa `git checkout -b calisma-analizi`).
- **Commit:** Kullanıcı kuralı — commit/push YALNIZ kullanıcı izin verince. İzin yoksa "Commit" adımında `git add` YAPMA; değişen dosyaları listele ve geç.
- **Global ad çakışması:** Tüm yerel `*.js` dosyaları klasik script, tek global sözlük. `analysis-logic.js`'teki her üst düzey ad `ANALYSIS_` / `analysis` önekli. Yeni dosya ekleyince tara:
  `for f in *.js; do grep -oE "^(const|let|var|function) +[A-Za-z_$][A-Za-z0-9_$]*" $f; done | sort | uniq -d` → çıktı BOŞ olmalı.
- **Testler:** `node --test` (kök dizinden, ARGÜMANSIZ; tek dosya için `node --test test/<ad>.test.js`). UI: `npm run test:ui`. Testler `TZ=Europe/Istanbul` varsayar (Git Bash'te `TZ=Europe/Istanbul node --test`).
- **Tailwind:** yeni sınıf yazınca `npm run build:css`; parça parça sınıf adı üretme (`'bg-'+x` yasak), Tailwind ölçeğinde olmayan sınıf yazma.
- **Şablonların içine `position:fixed` öğe koyma** (`test/sablon-fixed.test.js`). Body seviyesinde oluşturulan öğe serbest.
- **Planlamayı LLM yapmaz:** AI Agent prompt'una oran gönderilmez.
- **İstanbul günü:** Türkiye yaz saati uygulamıyor → gün anahtarı `new Date(ms + 3*3600000).toISOString().slice(0,10)`.
- **Sabitler (spec'ten, aynen):** soru oranları `shorter=0.75, same=1.0, longer=1.4`, soru ağırlığı `0.5`, yumuşatma `k=5`, oran sınırı `0.6–2.5`, oran penceresi `30 gün`, odak penceresi `14 gün`, en az `8` oturum, öneri farkı `≥5 dk`, öneri sınırı `10–60 dk` (5'e yuvarlı), unutulmuş sayaç `> 3 × planlanan` veya `> 240 dk`, soru şeridi `8 sn`, "Şimdilik değil" `7 gün`, mail eşiği `oran ≥ 1.2 ve ≥ 5 örnek`.

## File Structure

| Dosya | Durum | Sorumluluk |
|---|---|---|
| `add-calibration.sql` | Yeni | DDL: tasks'a 7 kolon, profiles'a `calibration`, indeks |
| `schema.sql` | Değişir | Aynı kolonlar şemaya işlenir (yeni kurulumlar için) |
| `analysis-logic.js` | Yeni | Saf: sayaç yamaları, örnekler, oranlar, odak önerisi, günlük dilimler, mail satırı, calibration parse |
| `test/analysis-logic.test.js` | Yeni | Yukarıdakinin birim testleri |
| `profile-logic.js` | Değişir | `rowToProfile` → `calibration`; `planningProfile` → `durationFactors` |
| `test/profile-logic.test.js` | Değişir | Yeni alanların testleri |
| `tasks-view.js` | Değişir | Sayaç ↔ veritabanı, süre doldu satırı, tamamlama yaması, soru şeridi |
| `analysis-view.js` | Yeni | Profil kartı (satır içi SVG), yenile/kaydet, Uygula / Şimdilik değil |
| `index.html` | Değişir | Script etiketleri, profil şablonuna `#analysis-card`, `loadPage('profile')` kancası, sayaç şablonuna `#timer-overtime` |
| `n8n-workflow-focusaid.json` | Değişir | `Normalize & Calculate`: `durationFactors` geçişi; `Code in JavaScript`: blok uzunluğu |
| `test/n8n-placement.test.js` | Değişir | Çarpan testleri |
| `n8n-workflow-report.json` | Değişir | profiles select'e `calibration`; `sure_notu`; prompt satırı |
| `test/n8n-report.test.js` | Yeni | Rapor node'unu koşturur, `sure_notu` ↔ `analysisMailLine` eşitliği |
| `test-ui/calisma-analizi.mjs` | Yeni | Kart görünümleri + sayaç şablonu |
| `package.json` | Değişir | `test:ui`'ye yeni dosya |

---

### Task 1: Veritabanı migration'ı

**Files:**
- Create: `add-calibration.sql`
- Modify: `schema.sql` (tasks `CREATE TABLE` bloğu ve profiles bloğu)

**Interfaces:**
- Produces: `tasks.started_at TIMESTAMPTZ`, `tasks.running_since TIMESTAMPTZ`, `tasks.active_seconds INT`, `tasks.longest_stretch_sec INT`, `tasks.actual_minutes INT`, `tasks.duration_feedback TEXT ('shorter'|'same'|'longer')`, `tasks.completed_at TIMESTAMPTZ`, `profiles.calibration JSONB`. Hepsi NULL olabilir.

- [ ] **Step 1: `add-calibration.sql` yaz**

```sql
-- FocusAid — çalışma analizi ve süre kalibrasyonu (2026-10-12)
-- Spec: docs/superpowers/specs/2026-10-12-calisma-analizi-kalibrasyon-design.md
-- Supabase SQL Editor'de KULLANICI çalıştırır. Tekrar çalıştırmak güvenli (IF NOT EXISTS).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS running_since       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_seconds      INT,
  ADD COLUMN IF NOT EXISTS longest_stretch_sec INT,
  ADD COLUMN IF NOT EXISTS actual_minutes      INT,
  ADD COLUMN IF NOT EXISTS duration_feedback   TEXT
    CHECK (duration_feedback IN ('shorter', 'same', 'longer')),
  ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calibration JSONB;

-- Analiz sorgusu: user_id + completed_at aralığı
CREATE INDEX IF NOT EXISTS tasks_user_completed_at_idx
  ON public.tasks (user_id, completed_at);

-- Doğrulama (çalıştırınca 8 satır dönmeli):
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'tasks' AND column_name IN
        ('started_at','running_since','active_seconds','longest_stretch_sec',
         'actual_minutes','duration_feedback','completed_at'))
    OR (table_name = 'profiles' AND column_name = 'calibration'))
ORDER BY table_name, column_name;
```

RLS: mevcut "Kendi görevlerini düzenle" (tasks UPDATE) ve profiles UPDATE politikaları kolon bazlı değil → yeni politika gerekmez.

- [ ] **Step 2: `schema.sql`'e işle**

`schema.sql`'deki `CREATE TABLE IF NOT EXISTS public.tasks (` bloğunda `created_at` satırından ÖNCE ekle:

```sql
  started_at          TIMESTAMPTZ,
  running_since       TIMESTAMPTZ,
  active_seconds      INT,
  longest_stretch_sec INT,
  actual_minutes      INT,
  duration_feedback   TEXT CHECK (duration_feedback IN ('shorter', 'same', 'longer')),
  completed_at        TIMESTAMPTZ,
```

profiles `CREATE TABLE` bloğunun kolon listesine `calibration JSONB,` ekle (konumu: son kolondan önce; virgül sözdizimini koru). Dosya sonuna indeksi ekle:

```sql
CREATE INDEX IF NOT EXISTS tasks_user_completed_at_idx ON public.tasks (user_id, completed_at);
```

- [ ] **Step 3: Kullanıcıya bırakılacak adımı not et**

Bu görev kodla doğrulanamaz: DDL'i asistan çalıştıramıyor. Görev raporuna şunu yaz: "Kullanıcı `add-calibration.sql`'i Supabase (FocusAid projesi, `tigawsmrndalzvuyjycc`) SQL Editor'de Run etmeli; son SELECT 8 satır dönmeli." Sonraki görevler kolonlar YOKKEN de testleri geçer (saf mantık + sahte veri); canlı doğrulama Task 8'de.

- [ ] **Step 4: Commit** (izin varsa)

```bash
git add add-calibration.sql schema.sql
git commit -m "db: çalışma analizi kolonları (tasks ölçüm alanları + profiles.calibration)"
```

---

### Task 2: `analysis-logic.js` — sayaç yamaları

**Files:**
- Create: `analysis-logic.js`
- Create: `test/analysis-logic.test.js`

**Interfaces:**
- Produces (hepsi saf, girdiyi değiştirmez, `nowMs` dışarıdan):
  - `analysisPlannedMinutes(task) → number|null` — `end_time - start_time` dakika; geçersizse null.
  - `analysisActiveSeconds(task, nowMs) → number` — `active_seconds` + (çalışıyorsa) şu anki dilim.
  - `analysisTimerStart(task, nowMs) → patch` — zaten çalışıyorsa `{}`; değilse `{ running_since: iso, started_at?: iso }` (`started_at` yalnız boşsa).
  - `analysisTimerPause(task, nowMs) → patch` — çalışmıyorsa `{}`; değilse `{ running_since: null, active_seconds: int, longest_stretch_sec: int }`.
  - `analysisCompletionPatch(task, nowMs) → { patch, needsFeedback: boolean }`
  - `analysisUncompletePatch() → { completed_at: null, actual_minutes: null, duration_feedback: null }`
  - Sabitler: `ANALYSIS_FORGOTTEN_MULT = 3`, `ANALYSIS_FORGOTTEN_MAX_MIN = 240`.

- [ ] **Step 1: Başarısız testleri yaz** — `test/analysis-logic.test.js`

```js
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
test('bir dakikadan kisa olcum 1 dakika yazilir', () => {
  const t = gorev({ started_at: iso(T0), running_since: iso(T0), active_seconds: 0 });
  assert.strictEqual(A.analysisCompletionPatch(t, T0 + 20000).patch.actual_minutes, 1);
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
```

- [ ] **Step 2: Koş, düştüğünü gör**

Run: `node --test test/analysis-logic.test.js`
Expected: FAIL — `Cannot find module '../analysis-logic.js'`

- [ ] **Step 3: Uygula** — `analysis-logic.js`

```js
/* ══════════════════════════════════════════════════════════════
   FocusAid — Çalışma analizi saf mantık katmanı
   DOM YOK, ağ YOK, `Date.now()` YOK. Zaman daima dışarıdan verilir.
   Testler: node --test   (kök dizinden, ARGÜMANSIZ)

   Spec: docs/superpowers/specs/2026-10-12-calisma-analizi-kalibrasyon-design.md

   ⚠️ Bu dosya index.html'e KLASİK script olarak yükleniyor; tüm üst düzey
   adlar `ANALYSIS_` / `analysis` önekli (global sözlük çakışması, 2026-08-30).
   ══════════════════════════════════════════════════════════════ */

const ANALYSIS_FORGOTTEN_MULT = 3;
const ANALYSIS_FORGOTTEN_MAX_MIN = 240;

function _analysisMs(value) {
  if (!value) return NaN;
  return new Date(value).getTime();
}

/** Planlanan süre (dk). Okunamıyorsa null — örnek analize alınmaz. */
function analysisPlannedMinutes(task) {
  const s = _analysisMs(task && task.start_time);
  const e = _analysisMs(task && task.end_time);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
}

/** Şu anki dilimin saniyesi; çalışmıyorsa 0. Saat geri giderse 0. */
function _analysisCurrentStretch(task, nowMs) {
  const r = _analysisMs(task && task.running_since);
  if (!Number.isFinite(r)) return 0;
  return Math.max(0, Math.floor((nowMs - r) / 1000));
}

/** Molalar hariç toplam çalışma saniyesi (çalışan dilim dahil). */
function analysisActiveSeconds(task, nowMs) {
  return (Number(task && task.active_seconds) || 0) + _analysisCurrentStretch(task, nowMs);
}

/** Başlat/Devam. Zaten çalışıyorsa {} — ikinci sekmenin basışı yok sayılır. */
function analysisTimerStart(task, nowMs) {
  if (task && task.running_since) return {};
  const now = new Date(nowMs).toISOString();
  const patch = {};
  if (!task || !task.started_at) patch.started_at = now;
  patch.running_since = now;
  return patch;
}

/** Duraklat. Çalışmıyorsa {}. */
function analysisTimerPause(task, nowMs) {
  if (!task || !task.running_since) return {};
  const stretch = _analysisCurrentStretch(task, nowMs);
  return {
    running_since: null,
    active_seconds: (Number(task.active_seconds) || 0) + stretch,
    longest_stretch_sec: Math.max(Number(task.longest_stretch_sec) || 0, stretch)
  };
}

/**
 * Tamamlanınca yazılacak alanlar.
 * Sayaç hiç kullanılmadıysa → yalnız completed_at, soru sorulur.
 * Sayaç unutulmuşsa (> 3 × planlanan veya > 240 dk) → actual_minutes null, soru sorulur.
 */
function analysisCompletionPatch(task, nowMs) {
  const completed_at = new Date(nowMs).toISOString();
  if (!task || !task.started_at) {
    return { patch: { completed_at }, needsFeedback: true };
  }
  const paused = analysisTimerPause(task, nowMs);
  const merged = { ...task, ...paused };
  const minutes = (Number(merged.active_seconds) || 0) / 60;
  const planned = analysisPlannedMinutes(task);
  const forgotten = minutes > ANALYSIS_FORGOTTEN_MAX_MIN
    || (planned !== null && minutes > planned * ANALYSIS_FORGOTTEN_MULT);
  const patch = {
    ...paused,
    actual_minutes: forgotten ? null : Math.max(1, Math.round(minutes)),
    completed_at
  };
  return { patch, needsFeedback: forgotten };
}

function analysisUncompletePatch() {
  return { completed_at: null, actual_minutes: null, duration_feedback: null };
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ANALYSIS_FORGOTTEN_MULT, ANALYSIS_FORGOTTEN_MAX_MIN,
    analysisPlannedMinutes, analysisActiveSeconds,
    analysisTimerStart, analysisTimerPause,
    analysisCompletionPatch, analysisUncompletePatch
  };
}
```

Not: "duraklatılmış sayaçla tamamlama" testinde `analysisTimerPause` `{}` döner, `active_seconds` 1500 → 25 dk; patch'te `running_since` yoktur — testin yalnız `actual_minutes` ve `completed_at`'e baktığına dikkat et.

- [ ] **Step 4: Koş, geçtiğini gör**

Run: `node --test test/analysis-logic.test.js` → Expected: PASS (17 test)
Run: `node --test` → Expected: tüm takım PASS
Run: ad çakışması taraması (Global Constraints) → Expected: boş çıktı

- [ ] **Step 5: Commit** (izin varsa)

```bash
git add analysis-logic.js test/analysis-logic.test.js
git commit -m "feat(analiz): sayaç ölçüm yamaları (saf mantık + testler)"
```

---

### Task 3: `analysis-logic.js` — analiz, calibration, mail satırı

**Files:**
- Modify: `analysis-logic.js` (Task 2'nin `module.exports` bloğunun ÜSTÜNE ekle, export listesini genişlet)
- Modify: `test/analysis-logic.test.js` (sonuna ekle)

**Interfaces:**
- Consumes: `analysisPlannedMinutes(task)` (Task 2)
- Produces:
  - `ANALYSIS_LOADS = ['low','medium','high']`, `ANALYSIS_LOAD_LABELS = { low:'Hafif', medium:'Orta', high:'Ağır' }`
  - `analysisSample(task) → { load, ratio, weight } | null`
  - `analysisFactors(tasks, nowMs) → { factors: {low,medium,high}, samples: {low,medium,high} }` (oranlar 2 ondalık, samples = ham örnek sayısı)
  - `analysisFocusSuggestion(tasks, nowMs, currentFocus) → { suggestion: number|null, timedSessions: number }`
  - `analysisDailyStretches(tasks, nowMs) → Array<{ day: 'YYYY-MM-DD', minutes: number }>` (14 eleman, eskiden yeniye; o gün yoksa 0)
  - `analysisCalibration(tasks, nowMs, currentFocus) → { computedAt, factors, samples, focusSuggestion, timedSessions }`
  - `analysisParseCalibration(raw) → aynı şekil` (null/bozuk → oranlar 1, samples 0, öneri null, timedSessions 0, computedAt null)
  - `analysisSameCalibration(a, b) → boolean` (computedAt hariç)
  - `analysisMailLine(calibration) → string` (koşul yoksa `''`)

- [ ] **Step 1: Başarısız testleri ekle** — `test/analysis-logic.test.js` sonuna

```js
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
```

- [ ] **Step 2: Koş, düştüğünü gör**

Run: `node --test test/analysis-logic.test.js` → Expected: FAIL (`A.analysisSample is not a function` vb.)

- [ ] **Step 3: Uygula** — `analysis-logic.js`, `module.exports` bloğunun üstüne

```js
// ═════ Analiz ═════
const ANALYSIS_LOADS = ['low', 'medium', 'high'];
const ANALYSIS_LOAD_LABELS = { low: 'Hafif', medium: 'Orta', high: 'Ağır' };
const ANALYSIS_FEEDBACK_RATIO = { shorter: 0.75, same: 1.0, longer: 1.4 };
const ANALYSIS_FEEDBACK_WEIGHT = 0.5;
const ANALYSIS_PRIOR_WEIGHT = 5;
const ANALYSIS_FACTOR_MIN = 0.6;
const ANALYSIS_FACTOR_MAX = 2.5;
const ANALYSIS_FACTOR_WINDOW_DAYS = 30;
const ANALYSIS_FOCUS_WINDOW_DAYS = 14;
const ANALYSIS_MIN_SESSIONS = 8;
const ANALYSIS_SUGGEST_MIN_DIFF = 5;
const ANALYSIS_FOCUS_MIN = 10;
const ANALYSIS_FOCUS_MAX = 60;
const ANALYSIS_MAIL_MIN_FACTOR = 1.2;
const ANALYSIS_MAIL_MIN_SAMPLES = 5;
const _ANALYSIS_DAY_MS = 86400000;

function _analysisClamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function _analysisRound2(x) { return Math.round(x * 100) / 100; }
function _analysisLoad(task) {
  const l = task && task.cognitive_load;
  return ANALYSIS_LOADS.includes(l) ? l : 'medium';
}
/** completed_at son `days` gün içinde mi. */
function _analysisInWindow(task, nowMs, days) {
  const c = _analysisMs(task && task.completed_at);
  return Number.isFinite(c) && c <= nowMs && nowMs - c <= days * _ANALYSIS_DAY_MS;
}
/** İstanbul günü (Türkiye yaz saati uygulamıyor: sabit +3). */
function _analysisIstanbulDay(ms) {
  return new Date(ms + 3 * 3600000).toISOString().slice(0, 10);
}
function _analysisMedian(list) {
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Tek görevden örnek: zamanlayıcı (ağırlık 1) > soru cevabı (ağırlık 0.5) > yok. */
function analysisSample(task) {
  const planned = analysisPlannedMinutes(task);
  if (planned === null) return null;
  const load = _analysisLoad(task);
  const actual = Number(task.actual_minutes);
  if (Number.isFinite(actual) && actual > 0) {
    return { load, ratio: _analysisRound2(actual / planned), weight: 1 };
  }
  const fb = ANALYSIS_FEEDBACK_RATIO[task.duration_feedback];
  if (fb !== undefined) return { load, ratio: fb, weight: ANALYSIS_FEEDBACK_WEIGHT };
  return null;
}

function analysisFactors(tasks, nowMs) {
  const sum = { low: 0, medium: 0, high: 0 };
  const weight = { low: 0, medium: 0, high: 0 };
  const samples = { low: 0, medium: 0, high: 0 };
  for (const t of tasks || []) {
    if (!_analysisInWindow(t, nowMs, ANALYSIS_FACTOR_WINDOW_DAYS)) continue;
    const s = analysisSample(t);
    if (!s) continue;
    sum[s.load] += s.ratio * s.weight;
    weight[s.load] += s.weight;
    samples[s.load] += 1;
  }
  const factors = {};
  for (const l of ANALYSIS_LOADS) {
    const n = weight[l];
    const r = n > 0 ? sum[l] / n : 1;
    const smoothed = (n * r + ANALYSIS_PRIOR_WEIGHT * 1) / (n + ANALYSIS_PRIOR_WEIGHT);
    factors[l] = _analysisRound2(_analysisClamp(smoothed, ANALYSIS_FACTOR_MIN, ANALYSIS_FACTOR_MAX));
  }
  return { factors, samples };
}

function _analysisStretchMinutes(task) {
  const sec = Number(task && task.longest_stretch_sec);
  return Number.isFinite(sec) && sec > 0 ? sec / 60 : null;
}

function analysisFocusSuggestion(tasks, nowMs, currentFocus) {
  const stretches = (tasks || [])
    .filter(t => _analysisInWindow(t, nowMs, ANALYSIS_FOCUS_WINDOW_DAYS))
    .map(_analysisStretchMinutes)
    .filter(m => m !== null);
  const timedSessions = stretches.length;
  if (timedSessions < ANALYSIS_MIN_SESSIONS) return { suggestion: null, timedSessions };
  const rounded = Math.round(_analysisMedian(stretches) / 5) * 5;
  const s = _analysisClamp(rounded, ANALYSIS_FOCUS_MIN, ANALYSIS_FOCUS_MAX);
  const current = Number(currentFocus) || 25;
  return {
    suggestion: Math.abs(s - current) >= ANALYSIS_SUGGEST_MIN_DIFF ? s : null,
    timedSessions
  };
}

function analysisDailyStretches(tasks, nowMs) {
  const days = [];
  for (let i = ANALYSIS_FOCUS_WINDOW_DAYS - 1; i >= 0; i--) {
    days.push({ day: _analysisIstanbulDay(nowMs - i * _ANALYSIS_DAY_MS), minutes: 0 });
  }
  const index = new Map(days.map((d, i) => [d.day, i]));
  for (const t of tasks || []) {
    const m = _analysisStretchMinutes(t);
    const c = _analysisMs(t && t.completed_at);
    if (m === null || !Number.isFinite(c)) continue;
    const i = index.get(_analysisIstanbulDay(c));
    if (i !== undefined) days[i].minutes = Math.max(days[i].minutes, Math.round(m));
  }
  return days;
}

function analysisCalibration(tasks, nowMs, currentFocus) {
  const { factors, samples } = analysisFactors(tasks, nowMs);
  const { suggestion, timedSessions } = analysisFocusSuggestion(tasks, nowMs, currentFocus);
  return {
    computedAt: new Date(nowMs).toISOString(),
    factors, samples, focusSuggestion: suggestion, timedSessions
  };
}

function analysisParseCalibration(raw) {
  let c = raw;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e) { c = null; } }
  if (!c || typeof c !== 'object') c = {};
  const f = (c.factors && typeof c.factors === 'object') ? c.factors : {};
  const s = (c.samples && typeof c.samples === 'object') ? c.samples : {};
  const factors = {}, samples = {};
  for (const l of ANALYSIS_LOADS) {
    const x = Number(f[l]);
    factors[l] = Number.isFinite(x) && x > 0
      ? _analysisRound2(_analysisClamp(x, ANALYSIS_FACTOR_MIN, ANALYSIS_FACTOR_MAX)) : 1;
    const n = Number(s[l]);
    samples[l] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  const fs = Number(c.focusSuggestion);
  const ts = Number(c.timedSessions);
  return {
    computedAt: typeof c.computedAt === 'string' ? c.computedAt : null,
    factors, samples,
    focusSuggestion: Number.isFinite(fs) && fs > 0 ? fs : null,
    timedSessions: Number.isFinite(ts) && ts > 0 ? Math.floor(ts) : 0
  };
}

function analysisSameCalibration(a, b) {
  const x = analysisParseCalibration(a), y = analysisParseCalibration(b);
  delete x.computedAt; delete y.computedAt;
  return JSON.stringify(x) === JSON.stringify(y);
}

/**
 * Haftalık mail satırı. ⚠️ n8n `Build Per-User Reports` node'unda birebir
 * kopyası var (`sureNotu`); test/n8n-report.test.js ikisinin aynı çıktıyı
 * verdiğini doğruluyor. Birini değiştirirsen ötekini de değiştir.
 */
function analysisMailLine(calibration) {
  if (!calibration || typeof calibration !== 'object') return '';
  const c = analysisParseCalibration(calibration);
  let best = null;
  for (const l of ANALYSIS_LOADS) {
    if (c.samples[l] < ANALYSIS_MAIL_MIN_SAMPLES) continue;
    if (c.factors[l] < ANALYSIS_MAIL_MIN_FACTOR) continue;
    if (!best || c.factors[l] > c.factors[best]) best = l;
  }
  if (!best) return '';
  const kat = c.factors[best].toFixed(1).replace('.', ',');
  return `${ANALYSIS_LOAD_LABELS[best]} görevlerin ortalama ${kat} kat sürdü — planlarını buna göre ayarlıyorum.`;
}
```

`module.exports` listesine ekle: `ANALYSIS_LOADS, ANALYSIS_LOAD_LABELS, analysisSample, analysisFactors, analysisFocusSuggestion, analysisDailyStretches, analysisCalibration, analysisParseCalibration, analysisSameCalibration, analysisMailLine`.

Test ölçüm notu: `zamanli(40)` → planlanan 25 → oran 1.6. "yumuşatma" testi: n=5, r=1.6 → (8+5)/10 = 1.3 ✓.

- [ ] **Step 4: Koş, geçtiğini gör**

Run: `node --test test/analysis-logic.test.js` → Expected: PASS
Run: `node --test` → Expected: tüm takım PASS
Run: ad çakışması taraması → Expected: boş

- [ ] **Step 5: Commit** (izin varsa)

```bash
git add analysis-logic.js test/analysis-logic.test.js
git commit -m "feat(analiz): tahmin oranı, odak önerisi, günlük dilimler, mail satırı"
```

---

### Task 4: Profil mantığı + n8n yerleştirici çarpanı

**Files:**
- Modify: `profile-logic.js` (`rowToProfile`, `planningProfile`, yeni `durationFactorsFromCalibration`; export listesi)
- Modify: `test/profile-logic.test.js` (sonuna ekle)
- Modify: `n8n-workflow-focusaid.json` → `Normalize & Calculate` ve `Code in JavaScript` node'larının `parameters.jsCode` alanları
- Modify: `test/n8n-placement.test.js` (sonuna ekle)

**Interfaces:**
- Consumes: yok (profile-logic.js `analysis-logic.js`'e BAĞIMLI DEĞİL — node testlerinde ayrı yüklenir; küçük normalleştirici burada kendi başına).
- Produces:
  - `rowToProfile(row).calibration` → ham değer ya da `null`
  - `durationFactorsFromCalibration(cal) → { low, medium, high }` (geçersiz → 1; 0.6–2.5 sınırlı)
  - `planningProfile(p).durationFactors` → yukarıdakinin sonucu
  - n8n `merged.profile.durationFactors`

- [ ] **Step 1: profile-logic testleri** — `test/profile-logic.test.js` sonuna (dosyanın başındaki require adını kullan; değilse `const P = require('../profile-logic.js');`)

```js
test('rowToProfile calibration alanini tasir, yoksa null', () => {
  assert.strictEqual(P.rowToProfile({}).calibration, null);
  const cal = { factors: { high: 1.6 } };
  assert.deepStrictEqual(P.rowToProfile({ calibration: cal }).calibration, cal);
});
test('durationFactorsFromCalibration gecersizde 1, sinirlar 0.6-2.5', () => {
  assert.deepStrictEqual(P.durationFactorsFromCalibration(null), { low: 1, medium: 1, high: 1 });
  assert.deepStrictEqual(P.durationFactorsFromCalibration({ factors: { low: 0.1, medium: 'x', high: 9 } }),
    { low: 0.6, medium: 1, high: 2.5 });
  assert.deepStrictEqual(P.durationFactorsFromCalibration('{"factors":{"high":1.6}}'),
    { low: 1, medium: 1, high: 1.6 });
});
test('planningProfile durationFactors gonderir', () => {
  assert.deepStrictEqual(P.planningProfile({}).durationFactors, { low: 1, medium: 1, high: 1 });
  assert.strictEqual(P.planningProfile({ calibration: { factors: { high: 1.6 } } }).durationFactors.high, 1.6);
});
test('profileToRow calibration GONDERMEZ (upsert eski degeri ezmesin)', () => {
  const row = P.profileToRow({ calibration: { factors: { high: 2 } } }, { id: 'u', email: 'e' });
  assert.strictEqual('calibration' in row, false);
});
```

- [ ] **Step 2: Koş, düştüğünü gör**

Run: `node --test test/profile-logic.test.js` → Expected: FAIL (`durationFactorsFromCalibration is not a function`, `calibration` undefined)

- [ ] **Step 3: profile-logic.js'i uygula**

`rowToProfile` dönüşüne son alan olarak ekle:

```js
    superpowers:      normalizeSuperpowers(r.superpowers),
    // Çalışma analizi sonucu (profiles.calibration, jsonb). Ham tutulur;
    // yorumlama analysis-logic.js'te. profileToRow bunu BİLEREK yazmaz.
    calibration:      r.calibration ?? null
```

`planningProfile`'ın hemen üstüne ekle:

```js
/**
 * profiles.calibration → n8n yerleştiricisinin blok çarpanları.
 * analysis-logic.js'teki analysisParseCalibration'ın küçük kardeşi; burada
 * ayrı durmasının nedeni profile-logic.js'in testlerde tek başına yüklenmesi.
 * Sınırlar spec'le aynı: 0.6–2.5, geçersiz → 1.
 */
function durationFactorsFromCalibration(cal) {
  let c = cal;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e) { c = null; } }
  const f = (c && typeof c === 'object' && c.factors && typeof c.factors === 'object') ? c.factors : {};
  const out = {};
  for (const l of ['low', 'medium', 'high']) {
    const x = Number(f[l]);
    out[l] = Number.isFinite(x) && x > 0 ? Math.min(2.5, Math.max(0.6, x)) : 1;
  }
  return out;
}
```

`planningProfile` dönüşüne son alan olarak ekle:

```js
    superpowers:      normalizeSuperpowers(p.superpowers),
    durationFactors:  durationFactorsFromCalibration(p.calibration)
```

`module.exports` listesine `durationFactorsFromCalibration` ekle. `profileToRow`'a DOKUNMA.

- [ ] **Step 4: Koş, geçtiğini gör**

Run: `node --test test/profile-logic.test.js` → PASS. Run: `node --test` → PASS (mevcut `rowToProfile`/`planningProfile` deepEqual testleri yeni alan yüzünden düşerse, o testlerin beklenen nesnesine `calibration: null` / `durationFactors: { low: 1, medium: 1, high: 1 }` ekle — davranış değişikliği değil, şekil genişlemesi).

- [ ] **Step 5: Yerleştirici testlerini yaz** — `test/n8n-placement.test.js` sonuna

```js
// ── sure carpani (calisma analizi, 2026-10-12) ──
function planCarpanli(carpanlar, gorevSayisi = 6, gunSonra = 3) {
  const merged = normalize({
    taskTitle: 'Deneme', userId: 'u',
    deadline: new Date(Date.now() + gunSonra * 86400000).toISOString(),
    userProfile: {
      focusPeriod: 25, breakStyle: 'pomodoro',
      workHours: { start: '09:00', end: '18:00' }, todayMood: '', hyperfocusLimit: 'none',
      durationFactors: carpanlar
    }
  });
  merged.existingEvents = [];
  return place(merged, gorevler(gorevSayisi));
}
const sureDk = (r) => (new Date(r.json.end) - new Date(r.json.start)) / 60000;

test('Normalize durationFactors i gecirir, yoksa hepsi 1', () => {
  const dl = new Date(Date.now() + 2 * 86400000).toISOString();
  const m = normalize({ taskTitle: 'x', userId: 'u', deadline: dl, userProfile: { focusPeriod: 25 } });
  assert.deepStrictEqual(m.profile.durationFactors, { low: 1, medium: 1, high: 1 });
  const m2 = normalize({ taskTitle: 'x', userId: 'u', deadline: dl,
    userProfile: { focusPeriod: 25, durationFactors: { low: 1, medium: 1.2, high: 1.6 } } });
  assert.deepStrictEqual(m2.profile.durationFactors, { low: 1, medium: 1.2, high: 1.6 });
});
test('carpan 1 iken blok = focusPeriod (eski davranis aynen)', () => {
  for (const r of planCarpanli({ low: 1, medium: 1, high: 1 })) assert.strictEqual(sureDk(r), 25);
});
test('carpan bloklari uzatir: high 1.6 -> 40 dk, medium 1.2 -> 30 dk', () => {
  const out = planCarpanli({ low: 1, medium: 1.2, high: 1.6 });
  for (const r of out) {
    const beklenen = { high: 40, medium: 30, low: 25 }[r.json.cognitiveLoad];
    assert.strictEqual(sureDk(r), beklenen, r.json.cognitiveLoad);
  }
});
test('carpanli planda da ust uste binme ve gorev kaybi yok', () => {
  for (const [gun, T] of [[1, 20], [2, 14], [3, 20], [7, 40]]) {
    const out = planCarpanli({ low: 0.6, medium: 1.5, high: 2.5 }, T, gun);
    assert.strictEqual(out.length, T, `${gun} gun / ${T} gorev -> kayip`);
    assert.strictEqual(ortusmeVar(out), false, `${gun} gun / ${T} gorev -> ortusme`);
  }
});
test('kucuk carpan bloku 10 dk altina indirmez', () => {
  const merged = normalize({ taskTitle: 'x', userId: 'u',
    deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
    userProfile: { focusPeriod: 15, breakStyle: 'pomodoro', workHours: { start: '09:00', end: '18:00' },
                   durationFactors: { low: 0.6, medium: 0.6, high: 0.6 } } });
  merged.existingEvents = [];
  for (const r of place(merged, gorevler(3))) assert.strictEqual(sureDk(r), 10);
});
```

- [ ] **Step 6: Koş, düştüğünü gör**

Run: `node --test test/n8n-placement.test.js` → Expected: FAIL (durationFactors undefined, bloklar 25)

- [ ] **Step 7: n8n node kodlarını değiştir**

JSON içindeki kod kaçışlı tek satır dize; elle düzenleme hataya açık. Bir kerelik betik yaz (scratchpad'e, repoya değil) ve `jsCode` alanlarını düz metin olarak değiştir:

```js
// scratchpad/n8n-carpan.js — çalıştır: node <yol>/n8n-carpan.js  (repo kökünden)
const fs = require('fs');
const F = 'n8n-workflow-focusaid.json';
const raw = fs.readFileSync(F, 'utf8');
const wf = JSON.parse(raw);
const node = (ad) => wf.nodes.find(n => n.name === ad);
const degistir = (ad, eski, yeni) => {
  const n = node(ad);
  if (!n.parameters.jsCode.includes(eski)) throw new Error(ad + ': bulunamadi -> ' + eski.slice(0, 60));
  n.parameters.jsCode = n.parameters.jsCode.split(eski).join(yeni);
};

// 1) Normalize & Calculate: durationFactors gecisi
degistir('Normalize & Calculate',
  "const superpowers = Array.isArray(profile.superpowers) ? profile.superpowers : [];",
  "const superpowers = Array.isArray(profile.superpowers) ? profile.superpowers : [];\n" +
  "// 2026-10-12 calisma analizi: zorluk bazli blok carpanlari (on yuzde hesaplanir, burada yalniz dogrulanir).\n" +
  "const _df = (profile.durationFactors && typeof profile.durationFactors === 'object') ? profile.durationFactors : {};\n" +
  "const durationFactors = {};\n" +
  "for (const l of ['low', 'medium', 'high']) { const x = Number(_df[l]); durationFactors[l] = Number.isFinite(x) && x > 0 ? Math.min(2.5, Math.max(0.6, x)) : 1; }");
degistir('Normalize & Calculate',
  "social, motivationNote, superpowers }",
  "social, motivationNote, superpowers, durationFactors }");

// 2) Code in JavaScript: blok uzunlugu
const P = 'Code in JavaScript';
degistir(P, "const step = focusPeriod + breakMinutes;",
  "const step = focusPeriod + breakMinutes;\n" +
  "// 2026-10-12 calisma analizi: gorev blogu = focusPeriod x kullanicinin o zorluktaki tahmin orani.\n" +
  "// Carpan 1 iken eski davranis AYNEN (yuvarlama yok). Alt sinir 10 dk.\n" +
  "const durationFactors = profile.durationFactors || {};\n" +
  "function blockMinutes(task) {\n" +
  "  const load = (task && (task.cognitiveLoad || task.cognitive_load)) || 'medium';\n" +
  "  const f = Number(durationFactors[load]);\n" +
  "  if (!Number.isFinite(f) || f <= 0 || f === 1) return focusPeriod;\n" +
  "  return Math.max(10, Math.round(focusPeriod * f / 5) * 5);\n" +
  "}");
degistir(P, "function firstFreeMinute(session) {\n  for (let m = session.start; m + focusPeriod <= session.end; m += step) {\n    if (isFree(m, m + focusPeriod)) return m;",
  "function firstFreeMinute(session, len) {\n  for (let m = session.start; m + len <= session.end; m += step) {\n    if (isFree(m, m + len)) return m;");
degistir(P, "function findSlot(session) {\n  if ((count[session.key] || 0) >= capFor(session)) return null;\n  return firstFreeMinute(session);",
  "function findSlot(session, len) {\n  if ((count[session.key] || 0) >= capFor(session)) return null;\n  return firstFreeMinute(session, len);");
degistir(P, "  const t = rawTasks[i] || {};\n",
  "  const t = rawTasks[i] || {};\n  const len = blockMinutes(t);\n");
degistir(P, "let s = findSlot(sessions[targetIdx]);", "let s = findSlot(sessions[targetIdx], len);");
degistir(P, "findSlot(sessions[j])", "findSlot(sessions[j], len)");   // iki komsu-gun dongusu (split/join: hepsi)
degistir(P, "const x = firstFreeMinute(sessions[j]);", "const x = firstFreeMinute(sessions[j], len);");
degistir(P, "while (!isFree(startAbs, startAbs + focusPeriod)) startAbs += step;",
  "while (!isFree(startAbs, startAbs + len)) startAbs += step;");
degistir(P, "reserve(startAbs, startAbs + focusPeriod);", "reserve(startAbs, startAbs + len);");
degistir(P, "end: isoFromAbsMin(startAbs + focusPeriod),", "end: isoFromAbsMin(startAbs + len),");
degistir(P, "deadlineAsiyor: startAbs + focusPeriod > deadlineAbsMin,", "deadlineAsiyor: startAbs + len > deadlineAbsMin,");

// Orijinal girinti/biçimi koru
const girinti = /^\{\n( +)"/.exec(raw);
fs.writeFileSync(F, JSON.stringify(wf, null, girinti ? girinti[1].length : 2) + (raw.endsWith('\n') ? '\n' : ''));
console.log('tamam');
```

Herhangi bir `degistir` "bulunamadi" atarsa, `node -e` ile ilgili satırları yazdır, dizeyi gerçek koda göre düzelt ve betiği tekrar çalıştır (betik idempotent değil — önce `git checkout n8n-workflow-focusaid.json`). Sonra `git diff --stat n8n-workflow-focusaid.json` ile yalnız iki node'un değiştiğini doğrula. Not: `Code in JavaScript` içinde `focusPeriod`'ın kalan kullanımları (seans uygunluğu `effectiveStart + focusPeriod > effectiveEnd`) BİLEREK kalır — seansın en az bir standart blok alması koşulu.

- [ ] **Step 8: Koş, geçtiğini gör**

Run: `node --test test/n8n-placement.test.js` → PASS (eski testler dahil)
Run: `node --test` → PASS

- [ ] **Step 9: Commit** (izin varsa)

```bash
git add profile-logic.js test/profile-logic.test.js n8n-workflow-focusaid.json test/n8n-placement.test.js
git commit -m "feat(analiz): planningProfile durationFactors + n8n yerleştiricide zorluk bazlı blok süresi"
```

---

### Task 5: Sayaç ↔ veritabanı (Bugün ekranı)

**Files:**
- Modify: `index.html` — script etiketleri; sayaç şablonuna `#timer-overtime`
- Modify: `tasks-view.js` — `TaskTimerState`, `initTaskTimerForTask`, `startTaskTimer`, `pauseTaskTimer`, `toggleTaskTimer`, `updateTimerUI`, `currentCardHTML` sayaç bloğu

**Interfaces:**
- Consumes: `analysisTimerStart`, `analysisTimerPause`, `analysisActiveSeconds`, `analysisPlannedMinutes` (Task 2); global `sb`, `findTask(id)`, `showToast`, `isGuestMode`
- Produces: `persistTimerPatch(task, patch) → Promise<boolean>` (Task 6 kullanır); `TaskTimerState.overtimeInterval`

Davranış (spec §2):
- Başlat → `analysisTimerStart` yaması task'a uygulanır + DB'ye yazılır; geri sayım başlar.
- Duraklat → `analysisTimerPause` yaması; geri sayım durur.
- Geri sayım 0'a inince: zil/konfeti/toast AYNEN, ama ÖLÇÜM SÜRER (`running_since` dokunulmaz). Donut altında `#timer-overtime`: "süre doldu · +N dk", 60 sn'de bir güncellenir. Düğme "Duraklat" kalır (ölçüm çalışıyor).
- Sayfa yenilenince: `initTaskTimerForTask` kalan süreyi `toplam − analysisActiveSeconds` olarak kurar; `running_since` doluysa geri sayımı (ya da süre doldu modunu) DB'ye yazmadan sürdürür.
- Misafir modunda DB yazımı yok (yalnız bellek, eski davranış).
- DB yazımı başarısızsa: task alanları önceki değerine döner, sayaç önceki durumuna döner, toast "Sayaç kaydedilemedi."

- [ ] **Step 1: Script etiketi ve şablon**

`index.html`'de `<script src="profile-logic.js"></script>` satırının hemen ALTINA:

```html
<script src="analysis-logic.js"></script>
```

`tasks-view.js` `currentCardHTML` içindeki sayaç bloğunda, düğme sütununda (`<div class="flex flex-col gap-2">`) `+5 Dk` butonunun kapanış `</button>` etiketinden HEMEN SONRA ekle:

```html
            <span id="timer-overtime" class="hidden text-[11px] font-medium text-slate-400 dark:text-slate-500"></span>
```

- [ ] **Step 2: tasks-view.js — durum ve yardımcılar**

`TaskTimerState`'e alan ekle:

```js
const TaskTimerState = {
  taskId: null,
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  isRunning: false,
  interval: null,
  overtimeInterval: null   // süre doldu ama ölçüm sürüyor: dakikalık güncelleme
};
```

`initTaskTimerForTask`'ın üstüne ekle:

```js
// ── ÖLÇÜM (çalışma analizi, 2026-10-12) ──
// Sayaç artık yalnız geri sayım değil: Başlat/Duraklat görev satırına yazılır
// (started_at, running_since, active_seconds, longest_stretch_sec) ve sayfa
// yenilense de kaldığı yerden sürer. Spec: 2026-10-12-calisma-analizi-kalibrasyon-design.md

function timerTask() {
  return TaskTimerState.taskId ? findTask(TaskTimerState.taskId) : null;
}
function timerMeasuring(task) {
  return !!(task && task.running_since);
}

/** Yamayı task'a uygular ve DB'ye yazar. Hata olursa task'ı geri alır, false döner. */
async function persistTimerPatch(task, patch) {
  const keys = Object.keys(patch || {});
  if (!task || keys.length === 0) return true;
  const onceki = {};
  for (const k of keys) onceki[k] = task[k] ?? null;
  Object.assign(task, patch);
  if (typeof isGuestMode !== 'undefined' && isGuestMode) return true;
  const { error } = await sb.from('tasks').update(patch).eq('id', task.id);
  if (error) {
    Object.assign(task, onceki);
    console.warn('[Sayaç] kaydedilemedi:', error.code, error.message);
    showToast('Sayaç kaydedilemedi.', 'error');
    return false;
  }
  return true;
}

function stopOvertime() {
  if (TaskTimerState.overtimeInterval) clearInterval(TaskTimerState.overtimeInterval);
  TaskTimerState.overtimeInterval = null;
}

/** Süre doldu satırı: sakin, dakikada bir. Ölçüm durmuşsa gizlenir. */
function updateOvertimeUI() {
  const el = document.getElementById('timer-overtime');
  if (!el) return;
  const task = timerTask();
  const planned = task ? analysisPlannedMinutes(task) : null;
  const aktifDk = task ? Math.floor(analysisActiveSeconds(task, Date.now()) / 60) : 0;
  const fazla = planned === null ? 0 : aktifDk - planned;
  if (TaskTimerState.remainingSeconds > 0 || fazla <= 0) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = `süre doldu · +${fazla} dk`;
  el.classList.remove('hidden');
}

function startOvertime() {
  stopOvertime();
  updateOvertimeUI();
  TaskTimerState.overtimeInterval = setInterval(updateOvertimeUI, 60000);
}
```

- [ ] **Step 3: tasks-view.js — init / start / pause / toggle**

`initTaskTimerForTask`'ı tamamen değiştir:

```js
function initTaskTimerForTask(task) {
  if (!task) {
    resetTaskTimer();
    return;
  }
  if (TaskTimerState.taskId === String(task.id)) return;

  const start = new Date(task.start_time).getTime();
  const end = new Date(task.end_time).getTime();
  let durationMins = (!isNaN(start) && !isNaN(end) && end > start)
    ? Math.round((end - start) / 60000)
    : 25;
  if (durationMins <= 0 || durationMins > 180) durationMins = 25;

  if (TaskTimerState.interval) clearInterval(TaskTimerState.interval);
  stopOvertime();
  TaskTimerState.taskId = String(task.id);
  TaskTimerState.totalSeconds = durationMins * 60;
  // Kayıtlı ölçüm varsa kaldığı yerden: kalan = toplam − çalışılmış.
  const calisilan = analysisActiveSeconds(task, Date.now());
  TaskTimerState.remainingSeconds = Math.max(0, durationMins * 60 - calisilan);
  TaskTimerState.isRunning = false;
  TaskTimerState.interval = null;

  if (timerMeasuring(task)) {
    // Başka sekmede / önceki açılışta başlatılmış: DB'ye yazmadan sürdür.
    if (TaskTimerState.remainingSeconds > 0) runCountdown();
    else startOvertime();
  }
}
```

`startTaskTimer`'ı ikiye ayır — geri sayım döngüsü `runCountdown`, kullanıcı eylemi `startTaskTimer`:

```js
/** Geri sayım döngüsü. DB'ye YAZMAZ (yalnız ekran). */
function runCountdown() {
  if (TaskTimerState.isRunning) return;
  TaskTimerState.isRunning = true;
  stopOvertime();
  updateTimerUI();
  TaskTimerState.interval = setInterval(() => {
    if (TaskTimerState.remainingSeconds > 0) {
      TaskTimerState.remainingSeconds--;
      updateTimerUI();
      if (TaskTimerState.remainingSeconds === 0) {
        // Geri sayım biter, ÖLÇÜM SÜRER: kullanıcı çalışmaya devam ediyor olabilir.
        TaskTimerState.isRunning = false;
        clearInterval(TaskTimerState.interval);
        TaskTimerState.interval = null;
        playTimerEndChime();
        fireDopamineConfetti(false);
        showToast('⏰ Odak seansı tamamlandı! Harika iş çıkardın.', 'success');
        if (typeof NotificationManager !== 'undefined') {
          NotificationManager.notifySessionComplete();
        }
        if (timerMeasuring(timerTask())) startOvertime();
        updateTimerUI();
      }
    }
  }, 1000);
}

async function startTaskTimer() {
  if (TaskTimerState.isRunning) return;
  getAudioContext();
  // 🔔 Bildirim izni sor (ilk başlatmada)
  if (typeof NotificationManager !== 'undefined' && NotificationManager.isSupported && Notification.permission === 'default') {
    NotificationManager.requestPermission();
  }
  const task = timerTask();
  if (task) {
    const ok = await persistTimerPatch(task, analysisTimerStart(task, Date.now()));
    if (!ok) { updateTimerUI(); return; }
  }
  if (TaskTimerState.remainingSeconds > 0) runCountdown();
  else { startOvertime(); updateTimerUI(); }
}

async function pauseTaskTimer() {
  TaskTimerState.isRunning = false;
  if (TaskTimerState.interval) clearInterval(TaskTimerState.interval);
  TaskTimerState.interval = null;
  stopOvertime();
  updateTimerUI();
  updateOvertimeUI();
  const task = timerTask();
  if (task && timerMeasuring(task)) {
    const ok = await persistTimerPatch(task, analysisTimerPause(task, Date.now()));
    if (!ok) {
      // DB'de hâlâ çalışıyor: ekranı da çalışır göster.
      if (TaskTimerState.remainingSeconds > 0) runCountdown(); else startOvertime();
    }
    updateTimerUI();
  }
}

function toggleTaskTimer() {
  const olcuyor = TaskTimerState.isRunning || timerMeasuring(timerTask());
  if (olcuyor) pauseTaskTimer();
  else startTaskTimer();
}
```

`resetTaskTimer`: ekrandan ayrılırken DB'ye yazmasın diye `pauseTaskTimer()` çağrısını yerel durdurmaya çevir:

```js
function resetTaskTimer() {
  TaskTimerState.isRunning = false;
  if (TaskTimerState.interval) clearInterval(TaskTimerState.interval);
  TaskTimerState.interval = null;
  stopOvertime();
  TaskTimerState.taskId = null;
  TaskTimerState.totalSeconds = 25 * 60;
  TaskTimerState.remainingSeconds = 25 * 60;
}
```

`updateTimerUI` içinde düğme durumu ölçüme bağlanır: `TaskTimerState.isRunning ?` olan iki koşulu `const olcuyor = TaskTimerState.isRunning || timerMeasuring(timerTask());` ile hesaplayıp `olcuyor ?` ile değiştir. Fonksiyonun sonuna `updateOvertimeUI();` ekle.

`grep -n "pauseTaskTimer\|startTaskTimer" *.js index.html` ile başka çağıran var mı bak; varsa (ör. bildirim/oda kodu) çağrının async olmasının sorun yaratmadığını doğrula (dönüş değeri kullanılmıyorsa sorun yok).

- [ ] **Step 4: Birim + UI takımı**

Run: `node --test` → PASS. Run: `npm run build:css` (yeni sınıf yok ama `hidden`/`text-[11px]` zaten varsa CSS değişmez; değişirse sorun değil). Run: `npm run test:ui` → PASS (misafir modunda Bugün ekranı ham hata göstermiyor; sayaç DB'ye gitmiyor).
Run: ad çakışması taraması → boş (`timerTask`, `timerMeasuring`, `persistTimerPatch`, `stopOvertime`, `startOvertime`, `updateOvertimeUI`, `runCountdown` yeni global adlar).

- [ ] **Step 5: Commit** (izin varsa)

```bash
git add index.html tasks-view.js tailwind.css
git commit -m "feat(analiz): görev sayacı ölçümü kaydediyor, yenilemede sürüyor, süre dolunca sakin satır"
```

---

### Task 6: Tamamlama yaması + soru şeridi

**Files:**
- Modify: `tasks-view.js` — `toggleTask`; yeni `showDurationFeedback`, `answerDurationFeedback`, `hideDurationFeedback`

**Interfaces:**
- Consumes: `analysisCompletionPatch`, `analysisUncompletePatch` (Task 2); `TaskTimerState`, `resetTaskTimer`, `stopOvertime` (Task 5); `analysisRefresh()` (Task 7 — `typeof` ile korumalı çağrılır, yoksa atlanır)
- Produces: `answerDurationFeedback(id, value)` global (şerit düğmeleri çağırır)

- [ ] **Step 1: `toggleTask`'ı güncelle**

`toggleTask` içinde `renderToday();` satırından ÖNCE yama hazırla, `sb.from('tasks').update(...)` çağrısında kullan, hata dalında geri al, başarıda şeridi göster. Fonksiyonun yeni hali:

```js
async function toggleTask(id) {
  const task = findTask(id);
  if (!task) return;

  const yeniDurum = !task.completed;
  // Ölçüm yaması (çalışma analizi): tamamlarken sayaç durur ve gerçek süre yazılır;
  // geri alırken sonuç alanları temizlenir, sayaç alanları korunur.
  const nowMs = Date.now();
  const { patch: olcum, needsFeedback } = yeniDurum
    ? analysisCompletionPatch(task, nowMs)
    : { patch: analysisUncompletePatch(), needsFeedback: false };
  const onceki = {};
  for (const k of Object.keys(olcum)) onceki[k] = task[k] ?? null;

  if (yeniDurum && TaskTimerState.taskId === String(task.id)) resetTaskTimer();
  task.completed = yeniDurum;   // iyimser: UI hemen güncellenir
  Object.assign(task, olcum);
  // Devreden görev tamamlanınca listeden düşmesin diye oturum hafızasına al.
  if (yeniDurum) {
    TodayState.sessionCompleted.add(String(task.id));
    const { done, total } = computeProgress(TodayState.today, TodayState.carried);
    const isAllDone = done === total && total > 0;
    fireDopamineConfetti(isAllDone);
    if (isAllDone) {
      playGrandVictoryChime();
      // Bugünün ödülü zaten kazanıldıysa çark kendiliğinden açılmaz
      // (görevi işaretleyip kaldırarak yeniden açtırma yolu kapansın).
      const zatenKazanildi = typeof bugununCarkOdulunuAl === 'function' && bugununCarkOdulunuAl();
      if (typeof openDopaminCarki === 'function' && !zatenKazanildi) {
        setTimeout(openDopaminCarki, 700);
      }
    } else {
      playSuccessChime();
    }
  } else {
    TodayState.sessionCompleted.delete(String(task.id));
  }
  renderToday();

  const { error } = await sb.from('tasks').update({ completed: yeniDurum, ...olcum }).eq('id', task.id);
  if (error) {
    task.completed = !yeniDurum;   // geri al
    Object.assign(task, onceki);
    if (yeniDurum) TodayState.sessionCompleted.delete(String(task.id));
    renderToday();
    showToast('Kaydedilemedi, tekrar dene.', 'error');
    return;
  }

  syncCalendarMark(task, yeniDurum);   // await YOK: ana akışı bekletmez
  if (yeniDurum && needsFeedback) showDurationFeedback(task);
  if (!yeniDurum) hideDurationFeedback();
  if (typeof analysisRefresh === 'function') analysisRefresh();   // await YOK
}
```

⚠️ Canlıda `add-calibration.sql` çalıştırılmadan bu sürüm yayına çıkarsa `update` bilinmeyen kolon hatası verir ve tamamlama KIRILIR. Bu yüzden Task 8'deki sıra zorunlu: önce SQL, sonra deploy.

- [ ] **Step 2: Soru şeridi**

`toggleTask`'ın altına ekle. Öğe body seviyesinde oluşturulur (şablon içinde `fixed` yasağına uyar), inline `onclick` ana belgede olduğu için güvenli:

```js
// ── SÜRE SORUSU (zamanlayıcı kullanılmadıysa) ──
// Tek dokunuş, atlanabilir, 8 sn sonra kendiliğinden kapanır. Cevap yoksa
// duration_feedback NULL kalır — kullanıcıyı zorlamak veriyi bozmaktan beter.
const DURATION_FEEDBACK_MS = 8000;
let _durationFeedbackTimer = null;

function hideDurationFeedback() {
  if (_durationFeedbackTimer) clearTimeout(_durationFeedbackTimer);
  _durationFeedbackTimer = null;
  document.getElementById('duration-feedback')?.remove();
}

function showDurationFeedback(task) {
  hideDurationFeedback();
  if (typeof isGuestMode !== 'undefined' && isGuestMode) return;
  const el = document.createElement('div');
  el.id = 'duration-feedback';
  el.className = 'fixed inset-x-0 bottom-6 mx-auto w-fit max-w-[calc(100%-2rem)] z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 shadow-lg text-sm text-slate-600 dark:text-slate-300';
  const id = _escape(task.id);
  el.innerHTML = `
    <span>Tahminden</span>
    <button onclick="answerDurationFeedback('${id}','shorter')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">kısa</button>
    <button onclick="answerDurationFeedback('${id}','same')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">aynı</button>
    <button onclick="answerDurationFeedback('${id}','longer')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">uzun</button>
    <span>sürdü</span>
    <button onclick="hideDurationFeedback()" aria-label="Atla" class="ml-1 text-slate-400 hover:text-slate-600">✕</button>`;
  document.body.appendChild(el);
  _durationFeedbackTimer = setTimeout(hideDurationFeedback, DURATION_FEEDBACK_MS);
}

async function answerDurationFeedback(id, value) {
  hideDurationFeedback();
  const task = findTask(id);
  if (!task || !['shorter', 'same', 'longer'].includes(value)) return;
  task.duration_feedback = value;
  const { error } = await sb.from('tasks').update({ duration_feedback: value }).eq('id', task.id);
  if (error) {
    task.duration_feedback = null;
    showToast('Kaydedilemedi.', 'error');
    return;
  }
  if (typeof analysisRefresh === 'function') analysisRefresh();
}
```

(`_escape` `tasks-view.js`'te zaten var — `taskRowHTML` kullanıyor.) Not: `inset-x-0 mx-auto` CLAUDE.md'deki ortalama kuralı (`-translate-x-1/2` yasak).

- [ ] **Step 3: CSS + takımlar**

Run: `npm run build:css` (yeni sınıflar: `max-w-[calc(100%-2rem)]`, `w-fit`, `bottom-6` vb.)
Run: `node --test` → PASS (`test/sablon-fixed.test.js` dahil — şerit şablonda değil, JS'te)
Run: `npm run test:ui` → PASS (`tailwind-guncel` CSS'in güncel olduğunu doğrular)
Run: ad çakışması taraması → boş

- [ ] **Step 4: Commit** (izin varsa)

```bash
git add tasks-view.js tailwind.css
git commit -m "feat(analiz): tamamlamada gerçek süre yazılıyor, sayaç kullanılmadıysa tek dokunuşluk soru"
```

---

### Task 7: Profil kartı — "Çalışma Analizim"

**Files:**
- Create: `analysis-view.js`
- Modify: `index.html` — `<script src="analysis-view.js">`, profil şablonuna `#analysis-card`, `loadPage` profil kancası, `loadProfileFromSupabase` sonrası localStorage'a calibration
- Create: `test-ui/calisma-analizi.mjs`
- Modify: `package.json` (`test:ui`)

**Interfaces:**
- Consumes: `analysisCalibration`, `analysisDailyStretches`, `analysisParseCalibration`, `analysisSameCalibration`, `ANALYSIS_LOADS`, `ANALYSIS_LOAD_LABELS` (Task 3); globals `sb`, `currentUser`, `userProfile`, `isGuestMode`, `showToast`, `loadProfileToUI`
- Produces:
  - `analysisRefresh() → Promise<{calibration, daily} | null>` (Task 6 çağırır)
  - `renderAnalysisCard(container, { calibration, daily, focusPeriod, guest })` — DOM'a çizer, ağ yok (UI testi doğrudan çağırır)
  - `analysisMountCard()` — profil sayfası açılınca
  - `analysisApplySuggestion()`, `analysisDismissSuggestion()`

- [ ] **Step 1: Başarısız UI testini yaz** — `test-ui/calisma-analizi.mjs`

`test-ui/misafir-modu.mjs`'teki `before`/`after` sunucu+tarayıcı kurulumunu ve `misafirSayfasi()` fonksiyonunu AYNEN kopyala (import'lar dahil), sonra:

```js
const DOLU = {
  calibration: {
    computedAt: '2026-10-12T07:00:00Z',
    factors: { low: 1.05, medium: 1.2, high: 1.6 },
    samples: { low: 6, medium: 9, high: 5 },
    focusSuggestion: 35, timedSessions: 11
  },
  daily: Array.from({ length: 14 }, (_, i) => ({ day: new Date(Date.UTC(2026, 8, 29 + i)).toISOString().slice(0, 10), minutes: i % 3 ? 30 + i : 0 })),
  focusPeriod: 25, guest: false
};

test('misafirde kart "Giriş yapınca açılır" der', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('profile'));
  await sayfa.waitForTimeout(1300);
  const metin = await sayfa.evaluate(() => document.getElementById('analysis-card')?.innerText || 'YOK');
  assert.match(metin, /Giriş yapınca açılır/);
  await sayfa.close();
});

test('az veride grafik yok, sayaç ilerlemesi yazıyor', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('profile'));
  await sayfa.waitForTimeout(1000);
  const r = await sayfa.evaluate(() => {
    const el = document.getElementById('analysis-card');
    window.renderAnalysisCard(el, { calibration: null, daily: [], focusPeriod: 25, guest: false });
    return { metin: el.innerText, svg: el.querySelectorAll('svg').length };
  });
  assert.match(r.metin, /0\/8 oturum/);
  assert.strictEqual(r.svg, 0);
  await sayfa.close();
});

test('dolu veride 3 çubuk, 14 sütun ve öneri kutusu', async () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const sayfa = await misafirSayfasi();
    await sayfa.setViewportSize(vp);
    await sayfa.evaluate(() => window.loadPage('profile'));
    await sayfa.waitForTimeout(1000);
    const r = await sayfa.evaluate((veri) => {
      const el = document.getElementById('analysis-card');
      window.renderAnalysisCard(el, veri);
      const kart = el.getBoundingClientRect();
      return {
        metin: el.innerText,
        cubuk: el.querySelectorAll('[data-analysis-bar]').length,
        sutun: el.querySelectorAll('[data-analysis-col]').length,
        uygula: !!el.querySelector('[data-analysis-apply]'),
        animasyon: [...el.querySelectorAll('*')].some(n => getComputedStyle(n).animationName !== 'none'),
        tasma: kart.right > window.innerWidth + 1 || document.documentElement.scrollWidth > window.innerWidth
      };
    }, DOLU);
    assert.strictEqual(r.cubuk, 3, `${vp.width}: çubuk`);
    assert.strictEqual(r.sutun, 14, `${vp.width}: sütun`);
    assert.strictEqual(r.uygula, true, `${vp.width}: öneri`);
    assert.match(r.metin, /25 → 35 dk/);
    assert.match(r.metin, /×1,6/);
    assert.strictEqual(r.animasyon, false, `${vp.width}: kartta animasyon var`);
    assert.strictEqual(r.tasma, false, `${vp.width}: yatay taşma`);
    await sayfa.close();
  }
});

test('öneri yoksa öneri kutusu çizilmez', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('profile'));
  await sayfa.waitForTimeout(1000);
  const var_ = await sayfa.evaluate((veri) => {
    const el = document.getElementById('analysis-card');
    window.renderAnalysisCard(el, { ...veri, calibration: { ...veri.calibration, focusSuggestion: null } });
    return !!el.querySelector('[data-analysis-apply]');
  }, DOLU);
  assert.strictEqual(var_, false);
  await sayfa.close();
});
```

`package.json` `test:ui` dizisinin sonuna ` && node test-ui/calisma-analizi.mjs` ekle (`tailwind-guncel.mjs`'ten ÖNCE: `... calisma-odalari.mjs && node test-ui/calisma-analizi.mjs && node test-ui/tailwind-guncel.mjs`).

- [ ] **Step 2: Koş, düştüğünü gör**

Run: `node test-ui/calisma-analizi.mjs` → Expected: FAIL (`analysis-card` YOK / `renderAnalysisCard is not a function`)

- [ ] **Step 3: `analysis-view.js` yaz**

```js
/* ══════════════════════════════════════════════════════════════
   FocusAid — "Çalışma Analizim" kartı (Profil)
   Hesap analysis-logic.js'te (saf). Bu dosya: Supabase okuma/yazma + çizim.
   Sakinlik ilkesi (kullanıcı kararı 2026-10-12): animasyon yok, soluk renk,
   kütüphane yok — satır içi SVG.
   Spec: docs/superpowers/specs/2026-10-12-calisma-analizi-kalibrasyon-design.md
   ══════════════════════════════════════════════════════════════ */

const ANALYSIS_DISMISS_KEY = 'focusaid_analysis_dismiss';
const ANALYSIS_DISMISS_DAYS = 7;
// Tam sınıf adları (Tailwind kaynağı düz metin tarar; parça parça üretme).
const ANALYSIS_BAR_CLASS = {
  low: 'fill-emerald-300 dark:fill-emerald-700',
  medium: 'fill-amber-300 dark:fill-amber-700',
  high: 'fill-rose-300 dark:fill-rose-700'
};

let _analysisLast = null;   // son çizilen veri (Uygula/Şimdilik değil sonrası yeniden çizim)

function _analysisKat(x) { return '×' + Number(x).toFixed(1).replace('.', ','); }

function _analysisDismissed(value) {
  try {
    const d = JSON.parse(localStorage.getItem(ANALYSIS_DISMISS_KEY) || 'null');
    return !!d && d.value === value && Number(d.untilMs) > Date.now();
  } catch (e) { return false; }
}

function _analysisBarsSVG(c) {
  const W = 300, rowH = 26, max = 2.5, x0 = 52, w = W - x0 - 44;
  const xOf = (f) => x0 + (Math.min(f, max) / max) * w;
  const rows = ANALYSIS_LOADS.map((l, i) => {
    const y = i * rowH + 4;
    return `
      <g data-analysis-bar="${l}">
        <text x="0" y="${y + 13}" class="fill-slate-500 dark:fill-slate-400" font-size="11">${ANALYSIS_LOAD_LABELS[l]}</text>
        <rect x="${x0}" y="${y + 3}" width="${Math.max(2, xOf(c.factors[l]) - x0)}" height="12" rx="3" class="${ANALYSIS_BAR_CLASS[l]}"></rect>
        <text x="${xOf(c.factors[l]) + 6}" y="${y + 13}" class="fill-slate-600 dark:fill-slate-300" font-size="11">${_analysisKat(c.factors[l])} <tspan class="fill-slate-400" font-size="9">(${c.samples[l]})</tspan></text>
      </g>`;
  }).join('');
  const x1 = xOf(1);
  return `
    <svg viewBox="0 0 ${W} ${ANALYSIS_LOADS.length * rowH + 14}" class="w-full h-auto" role="img" aria-label="Tahmin ve gerçek süre oranı">
      ${rows}
      <line x1="${x1}" x2="${x1}" y1="0" y2="${ANALYSIS_LOADS.length * rowH + 4}" class="stroke-slate-300 dark:stroke-slate-600" stroke-dasharray="3 3"></line>
      <text x="${x1}" y="${ANALYSIS_LOADS.length * rowH + 13}" text-anchor="middle" class="fill-slate-400" font-size="9">1,0 = tam isabet</text>
    </svg>`;
}

function _analysisColsSVG(daily, focusPeriod) {
  const W = 300, H = 90, pad = 4, colW = (W - pad * 2) / 14;
  const max = Math.max(60, focusPeriod, ...daily.map(d => d.minutes));
  const yOf = (m) => H - 14 - (m / max) * (H - 24);
  const cols = daily.map((d, i) => {
    const h = Math.max(0, (H - 14) - yOf(d.minutes));
    return `<rect data-analysis-col="${d.day}" x="${pad + i * colW + 2}" y="${yOf(d.minutes)}" width="${colW - 4}" height="${h}" rx="2" class="fill-indigo-200 dark:fill-indigo-800"><title>${d.day}: ${d.minutes} dk</title></rect>`;
  }).join('');
  const yf = yOf(focusPeriod);
  return `
    <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Son 14 günün en uzun kesintisiz odak süresi">
      ${cols}
      <line x1="0" x2="${W}" y1="${yf}" y2="${yf}" class="stroke-slate-400 dark:stroke-slate-500" stroke-dasharray="4 3"></line>
      <text x="${W - 2}" y="${yf - 3}" text-anchor="end" class="fill-slate-400" font-size="9">odak süren ${focusPeriod} dk</text>
      <text x="0" y="${H - 2}" class="fill-slate-400" font-size="9">14 gün önce</text>
      <text x="${W}" y="${H - 2}" text-anchor="end" class="fill-slate-400" font-size="9">bugün</text>
    </svg>`;
}

/** Ağsız çizim. UI testi doğrudan çağırır. */
function renderAnalysisCard(container, { calibration, daily, focusPeriod, guest }) {
  if (!container) return;
  _analysisLast = { calibration, daily, focusPeriod, guest };
  const baslik = `<h3 class="font-bold text-slate-800 dark:text-slate-100">📈 Çalışma Analizim</h3>`;
  if (guest) {
    container.innerHTML = `<div class="glass-card p-6 bg-white shadow-sm space-y-2">${baslik}
      <p class="text-sm text-slate-500 dark:text-slate-400">Giriş yapınca açılır.</p></div>`;
    return;
  }
  const c = analysisParseCalibration(calibration);
  const toplamOrnek = ANALYSIS_LOADS.reduce((s, l) => s + c.samples[l], 0);
  if (c.timedSessions < 8 && toplamOrnek === 0) {
    container.innerHTML = `<div class="glass-card p-6 bg-white shadow-sm space-y-2">${baslik}
      <p class="text-sm text-slate-500 dark:text-slate-400">Analiz için ${c.timedSessions}/8 oturum — görev sayacını kullandıkça dolacak.</p></div>`;
    return;
  }
  const fp = Number(focusPeriod) || 25;
  const oneri = c.focusSuggestion && !_analysisDismissed(c.focusSuggestion)
    ? `<div class="rounded-2xl bg-slate-50 dark:bg-slate-700/40 p-4 space-y-3">
         <p class="text-sm text-slate-600 dark:text-slate-300">Ortalama ${c.focusSuggestion} dk kesintisiz odaklanıyorsun. Odak süreni <b>${fp} → ${c.focusSuggestion} dk</b> yapalım mı?</p>
         <div class="flex gap-2">
           <button data-analysis-apply onclick="analysisApplySuggestion()" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white">Uygula</button>
           <button onclick="analysisDismissSuggestion()" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-600/50 text-slate-700 dark:text-slate-200">Şimdilik değil</button>
         </div>
       </div>`
    : '';
  const sutunlar = Array.isArray(daily) && daily.length === 14
    ? `<div class="space-y-1"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">En uzun kesintisiz odak (gün başına)</p>${_analysisColsSVG(daily, fp)}</div>`
    : '';
  container.innerHTML = `
    <div class="glass-card p-6 bg-white shadow-sm space-y-5">
      ${baslik}
      <div class="space-y-1"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Tahmin ve gerçek süre (son 30 gün)</p>${_analysisBarsSVG(c)}</div>
      ${sutunlar}
      ${oneri}
    </div>`;
}

/** Görevleri çekip calibration'ı yeniden hesaplar; değiştiyse profile yazar. */
async function analysisRefresh() {
  if ((typeof isGuestMode !== 'undefined' && isGuestMode) || !currentUser) return null;
  const nowMs = Date.now();
  const since = new Date(nowMs - 30 * 86400000).toISOString();
  const { data, error } = await sb.from('tasks')
    .select('id,cognitive_load,start_time,end_time,started_at,actual_minutes,longest_stretch_sec,duration_feedback,completed_at')
    .gte('completed_at', since);
  if (error) { console.warn('[Analiz] görevler okunamadı:', error.code, error.message); return null; }
  const fp = Number(userProfile?.focusPeriod) || 25;
  const calibration = analysisCalibration(data || [], nowMs, fp);
  const daily = analysisDailyStretches(data || [], nowMs);
  if (!analysisSameCalibration(calibration, userProfile?.calibration)) {
    const { error: yazHata } = await sb.from('profiles').update({ calibration }).eq('id', currentUser.id);
    if (yazHata) console.warn('[Analiz] calibration yazılamadı:', yazHata.code, yazHata.message);
    else {
      userProfile.calibration = calibration;
      try { localStorage.setItem('focusaid_profile', JSON.stringify(userProfile)); } catch (e) {}
    }
  }
  const kart = document.getElementById('analysis-card');
  if (kart) renderAnalysisCard(kart, { calibration, daily, focusPeriod: fp, guest: false });
  return { calibration, daily };
}

async function analysisMountCard() {
  const kart = document.getElementById('analysis-card');
  if (!kart) return;
  const guest = (typeof isGuestMode !== 'undefined' && isGuestMode) || !currentUser;
  // Önce eldeki (hesaptaki) değerle hemen çiz, sonra tazele.
  renderAnalysisCard(kart, { calibration: userProfile?.calibration ?? null, daily: [],
                             focusPeriod: userProfile?.focusPeriod, guest });
  if (!guest) await analysisRefresh();
}

async function analysisApplySuggestion() {
  const c = analysisParseCalibration(userProfile?.calibration);
  if (!c.focusSuggestion || !currentUser) return;
  const yeni = c.focusSuggestion;
  const { error } = await sb.from('profiles').update({ focus_period: yeni }).eq('id', currentUser.id);
  if (error) { showToast('Kaydedilemedi, tekrar dene.', 'error'); return; }
  userProfile.focusPeriod = yeni;
  try { localStorage.setItem('focusaid_profile', JSON.stringify(userProfile)); } catch (e) {}
  showToast(`Odak süren ${yeni} dk oldu.`, 'success');
  if (typeof loadProfileToUI === 'function') loadProfileToUI();
  await analysisRefresh();   // öneri artık mevcut değere eşit → kaybolur
}

function analysisDismissSuggestion() {
  const c = analysisParseCalibration(userProfile?.calibration ?? _analysisLast?.calibration);
  try {
    localStorage.setItem(ANALYSIS_DISMISS_KEY, JSON.stringify({
      value: c.focusSuggestion, untilMs: Date.now() + ANALYSIS_DISMISS_DAYS * 86400000
    }));
  } catch (e) {}
  const kart = document.getElementById('analysis-card');
  if (kart && _analysisLast) renderAnalysisCard(kart, _analysisLast);
}
```

- [ ] **Step 4: index.html kancaları**

1. `<script src="analysis-logic.js"></script>` satırını bul; `<script src="tasks-view.js"></script>` satırının ALTINA ekle:
   ```html
   <script src="analysis-view.js"></script>
   ```
2. Profil şablonunda `<!-- Kaydet -->` yorumunun hemen ÜSTÜNE:
   ```html
   <!-- Çalışma Analizim (analysis-view.js) -->
   <div id="analysis-card"></div>
   ```
3. `loadPage` haritasındaki profil satırını değiştir:
   ```js
   profile:   () => { if (typeof loadProfileToUI === 'function') loadProfileToUI();
                      if (typeof analysisMountCard === 'function') analysisMountCard(); },
   ```
   (Önceki satır `typeof loadProfileToUI === 'function' && loadProfileToUI()` ifadesini döndürüyordu; dönüş değerini kullanan bir şey var mı `grep -n "PAGE_HOOKS\|profile:" index.html` ile bak — kullanılıyorsa aynı şekilde `return` et.)

`userProfile.calibration` `rowToProfile` ile (Task 4) zaten geliyor; ek iş yok.

- [ ] **Step 5: CSS + takımlar**

Run: `npm run build:css` (yeni: `fill-*`, `stroke-*`, `dark:fill-*` sınıfları)
Run: `node test-ui/calisma-analizi.mjs` → PASS
Run: `node --test` → PASS; `npm run test:ui` → PASS
Run: ad çakışması taraması → boş

Kırmızıya dönüşü göster (CLAUDE.md kuralı): `renderAnalysisCard`'da `data-analysis-bar` özniteliğini geçici sil → test FAIL vermeli → geri al.

- [ ] **Step 6: Commit** (izin varsa)

```bash
git add analysis-view.js index.html test-ui/calisma-analizi.mjs package.json tailwind.css
git commit -m "feat(analiz): Profil'de Çalışma Analizim kartı (sakin SVG, odak önerisi + onay)"
```

---

### Task 8: Haftalık mail satırı + canlıya çıkış kontrol listesi

**Files:**
- Modify: `n8n-workflow-report.json` — `Get all profiles` select, `Build Per-User Reports` jsCode, `AI Agent` text
- Create: `test/n8n-report.test.js`

**Interfaces:**
- Consumes: `analysisMailLine` (Task 3) — testte karşılaştırma için
- Produces: rapor item'ında `sure_notu: string`

- [ ] **Step 1: Başarısız testi yaz** — `test/n8n-report.test.js`

```js
/* n8n `Build Per-User Reports` node'unu DOGRUDAN kosturur; `sureNotu` kopyasinin
   analysis-logic.js'teki analysisMailLine ile ayni ciktiyi verdigini kilitler. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../analysis-logic.js');

const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'n8n-workflow-report.json'), 'utf8'));
const node = (ad) => wf.nodes.find(n => n.name === ad);
const kos = (profiles, tasks) => new Function('$', node('Build Per-User Reports').parameters.jsCode)(
  (ad) => ({ all: () => (ad === 'Get all profiles' ? profiles : tasks).map(json => ({ json })) })
);

const CALS = [
  null,
  { factors: { low: 1.05, medium: 1.3, high: 1.6 }, samples: { low: 9, medium: 6, high: 5 } },
  { factors: { low: 1, medium: 1.3, high: 1.9 }, samples: { low: 0, medium: 6, high: 4 } },
  { factors: { low: 1.1, medium: 1.1, high: 1.15 }, samples: { low: 9, medium: 9, high: 9 } },
  JSON.stringify({ factors: { high: 2.2 }, samples: { high: 7 } }),
  'bozuk{'
];

test('sure_notu analysisMailLine ile birebir ayni', () => {
  for (const cal of CALS) {
    const out = kos([{ id: 'u', email: 'a@b.c', calibration: cal }],
                    [{ user_id: 'u', name: 'G', start_time: '2026-10-12T07:00:00Z' }]);
    assert.strictEqual(out[0].json.sure_notu, A.analysisMailLine(cal), JSON.stringify(cal));
  }
});
test('bos haftada mail yok kurali korunuyor', () => {
  assert.strictEqual(kos([{ id: 'u', email: 'a@b.c' }], []).length, 0);
});
test('profiles sorgusu calibration i seciyor', () => {
  const q = JSON.stringify(node('Get all profiles').parameters);
  assert.match(q, /calibration/);
});
test('AI prompt sure_notu yu kullaniyor', () => {
  assert.match(node('AI Agent').parameters.text, /\{\{ \$json\.sure_notu \}\}/);
});
```

Not: `analysisMailLine('bozuk{')` → parse varsayılanı → `''`. `analysisMailLine` string girdiyi `typeof !== 'object'` diye `''` döndürür — JSON dizesi (CALS[4]) için de `''` döner. n8n Supabase'ten jsonb'yi NESNE olarak alır, yani dize vakası gerçekte oluşmaz; ama iki kopya yine AYNI davranmalı — `sureNotu` da aynı ilk kontrolü yapmalı.

- [ ] **Step 2: Koş, düştüğünü gör**

Run: `node --test test/n8n-report.test.js` → Expected: FAIL (`sure_notu` undefined)

- [ ] **Step 3: Rapor workflow'unu değiştir** — scratchpad'de bir kerelik betik

```js
// scratchpad/n8n-rapor.js — repo kökünden: node <yol>/n8n-rapor.js
const fs = require('fs');
const F = 'n8n-workflow-report.json';
const raw = fs.readFileSync(F, 'utf8');
const wf = JSON.parse(raw);
const node = (ad) => wf.nodes.find(n => n.name === ad);

// 1) profiles select
const qp = node('Get all profiles').parameters.queryParameters.parameters.find(p => p.name === 'select');
if (qp.value !== 'id,email,motivation_note') throw new Error('beklenmeyen select: ' + qp.value);
qp.value = 'id,email,motivation_note,calibration';

// 2) Build Per-User Reports: sureNotu (analysis-logic.js analysisMailLine'in BIREBIR kopyasi)
const b = node('Build Per-User Reports').parameters;
const SURE_NOTU = `
// ⚠️ analysis-logic.js'teki analysisMailLine'in BIREBIR kopyasi.
// test/n8n-report.test.js ikisinin ayni ciktiyi verdigini dogruluyor.
function sureNotu(calibration) {
  if (!calibration || typeof calibration !== 'object') return '';
  const f = (calibration.factors && typeof calibration.factors === 'object') ? calibration.factors : {};
  const s = (calibration.samples && typeof calibration.samples === 'object') ? calibration.samples : {};
  const ETIKET = { low: 'Hafif', medium: 'Orta', high: 'Ağır' };
  let best = null, bestF = 0;
  for (const l of ['low', 'medium', 'high']) {
    const x = Number(f[l]);
    const fx = Number.isFinite(x) && x > 0 ? Math.round(Math.min(2.5, Math.max(0.6, x)) * 100) / 100 : 1;
    const n = Number(s[l]);
    const nx = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    if (nx < 5 || fx < 1.2) continue;
    if (best === null || fx > bestF) { best = l; bestF = fx; }
  }
  if (best === null) return '';
  return ETIKET[best] + ' görevlerin ortalama ' + bestF.toFixed(1).replace('.', ',') + ' kat sürdü — planlarını buna göre ayarlıyorum.';
}
`;
if (!b.jsCode.includes('const results = [];')) throw new Error('results satiri yok');
b.jsCode = b.jsCode.replace('const results = [];', SURE_NOTU + '\nconst results = [];');
if (!b.jsCode.includes('      simdi_istanbul\n')) throw new Error('simdi_istanbul satiri yok');
b.jsCode = b.jsCode.replace('      simdi_istanbul\n', '      simdi_istanbul,\n      sure_notu: sureNotu(p.calibration)\n');

// 3) AI Agent prompt
const ai = node('AI Agent').parameters;
ai.text += "\n\nSüre analizi notu: {{ $json.sure_notu }}\nBu not BOŞSA ondan hiç bahsetme. DOLUYSA kapanış cümlesinden hemen önce, ayrı bir paragraf olarak, notu AYNEN (kelimesi kelimesine) yaz.";

const girinti = /^\{\n( +)"/.exec(raw);
fs.writeFileSync(F, JSON.stringify(wf, null, girinti ? girinti[1].length : 2) + (raw.endsWith('\n') ? '\n' : ''));
console.log('tamam');
```

`analysisMailLine` ile `sureNotu` aynı sıra/eşitlik kuralını izler: ikisi de ilk bulunan en yüksek oranı tutar (`>` kesin büyük). Test düşerse farkı kopyada değil, mantıkta ara ve İKİSİNİ birlikte düzelt.

- [ ] **Step 4: Koş, geçtiğini gör**

Run: `node --test test/n8n-report.test.js` → PASS. Run: `node --test` → PASS. Run: `npm run test:ui` → PASS.

- [ ] **Step 5: Commit** (izin varsa)

```bash
git add n8n-workflow-report.json test/n8n-report.test.js
git commit -m "feat(analiz): haftalık mailde süre analizi satırı"
```

- [ ] **Step 6: Canlıya çıkış — SIRA ZORUNLU (kullanıcıyla birlikte)**

Bu adımlar kullanıcı izni/eylemi gerektirir; asistan tek başına yapmaz, kullanıcıya bu listeyi sunar:

1. **SQL önce:** Kullanıcı `add-calibration.sql`'i Supabase SQL Editor'de Run eder; son SELECT 8 satır döner. (Önce bu — yoksa yeni `toggleTask` canlıda bilinmeyen kolon hatasıyla tamamlamayı kırar.)
2. **n8n:** `Normalize & Calculate`, `Code in JavaScript` (focusaid) ve `Build Per-User Reports` + `Get all profiles` + `AI Agent` (report) canlıya taşınır — `scripts/n8n-senkron.mjs yukle` (N8N_API_KEY varsa) ya da CLAUDE.md "n8n ile senkron" yöntemi (GitHub raw'dan `jsCode` çek; SHA-256 ile doğrula). ⚠️ Workflow JSON'ını kod alanına yapıştırma.
3. **Kod:** kullanıcı izniyle `calisma-analizi` → `main` fast-forward, push; Render ~40 sn.
4. **Canlı doğrulama:**
   - `curl -s https://dehb-asistan.onrender.com/index.html | grep -c analysis-view.js` → 1
   - Tarayıcıda: Bugün → sayaç Başlat → 1-2 dk → Duraklat → sayfayı yenile → kalan süre korunmuş mu → Tamamla. Supabase'te o satırda `actual_minutes`, `completed_at`, `longest_stretch_sec` dolu mu.
   - Sayaçsız bir görevi tamamla → soru şeridi çıkıyor mu → "uzun" → `duration_feedback = 'longer'`.
   - Profil → kart çiziliyor mu (az veri metni), `profiles.calibration` yazıldı mı.
   - Parçalayıcı'da bir görev böl → n8n Executions'ta `durationFactors` profilde görünüyor mu (oranlar henüz 1 ise bloklar 25 dk — beklenen).

---

## Self-Review notları

- Spec §1 veri → Task 1; §2 ölçüm → Task 2 + 5 + 6; §3 analiz → Task 3; §4 kart → Task 7; §5 plan etkisi → Task 4; §6 mail → Task 8; §7 hata durumları → Task 2 (iki sekme, unutulmuş sayaç), 5/6 (DB hatası geri alma), 3 (bozuk calibration), 7 (misafir); §8 test → her görevde.
- Ad tutarlılığı: `running_since`, `active_seconds`, `longest_stretch_sec` tüm görevlerde aynı; `durationFactors` profile-logic ↔ Normalize ↔ yerleştirici aynı; `analysisRefresh` Task 6'da `typeof` korumalı.
- Bilinen kabul: `profile-logic.js` ile `analysis-logic.js` arasında küçük oran normalleştirici tekrarı (bağımlılık kurmamak için); n8n'de `sureNotu` kopyası (n8n tarayıcı dosyası yükleyemiyor) — ikisi de testle kilitli ya da yorumla işaretli.
