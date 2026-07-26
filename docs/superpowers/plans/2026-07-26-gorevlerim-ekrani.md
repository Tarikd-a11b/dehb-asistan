# FocusAid "Bugün" (Görevlerim) Ekranı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase `tasks` tablosundaki mikro görevleri gösteren, tamamlama ve erteleme yapılabilen bir "Bugün" sekmesi eklemek.

**Architecture:** Saf mantık (tarih, sıralama, erteleme hesabı) DOM'dan ayrı bir `tasks-logic.js` dosyasında toplanır ve Node'un yerleşik test runner'ı ile gerçekten test edilir. DOM render'ı ve ağ çağrıları (Supabase, GAPI) `tasks-view.js` içinde durur ve tarayıcıda gözle doğrulanır. Şablon, projenin mevcut "fetch yok, CORS yok" desenine uyarak `index_2.html` içinde `<template id="tpl-today">` olarak kalır.

**Tech Stack:** Vanilla JS (ES2020, modül yok — global `<script>`), Supabase JS v2, Google API Client (gapi), Tailwind CDN, `node --test` (Node 24, sıfır bağımlılık).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-26-gorevlerim-ekrani-design.md` — çelişki halinde spec kazanır.
- **Veritabanı değişikliği YOK.** `fix-tasks-rls.sql`'deki SELECT/UPDATE politikaları yeterli.
- **n8n workflow değişikliği YOK.**
- **Doğruluk kaynağı Supabase'dir.** Google Calendar senkronu best-effort; hatası ana akışı bozamaz, Supabase yazımını geri aldıramaz.
- **Tarih hesapları yerel saatle.** `toISOString()` ile gün üretmek YASAK (UTC+3 nedeniyle gece 00:00–03:00 arası bir gün geriyi verir). Gün string'i her yerde `YYYY-MM-DD`.
- **`BREAK_MAP` eşlemesi n8n Code node'u ile birebir aynı olmalı:** `{ pomodoro: 5, 'long-break': 15, micro: 2, free: 0 }`, bilinmeyen/eksik değerde varsayılan `15`. Varsayılan `focusPeriod` = `25`.
- **Devretme tavanı 3 gün.**
- **RSD koruması:** Gecikmiş görevlerde kırmızı renk, "GECİKTİ" damgası, ayrı "Gecikenler" başlığı veya sayacı YASAK. Yalnızca nötr gri gün rozeti.
- **`index_2.html` ve `index.html` ikizdir.** `index_2.html`'de yapılan her değişiklik `index.html`'e de uygulanır (Task 8).
- **Dil:** Tüm kullanıcıya görünen metinler Türkçe.
- **Tarayıcı testi:** `python -m http.server 3000` + `http://localhost:3000/auth.html` (asla `127.0.0.1` değil — Supabase PKCE origin'e bağlı).

---

### Task 1: Saf mantık modülü ve testleri

Ekranın en riskli kısmı DOM değil, hesaplar: hangi görev "sıradaki", hangi gün "bugün", erteleme kaç dakika. Bunlar saf fonksiyonlar olarak yazılır ve gerçekten test edilir.

**Files:**
- Create: `tasks-logic.js`
- Create: `test/tasks-logic.test.js`
- Modify: `.gitignore` (test çıktısı yok, dokunulmayacak — sadece doğrula)

**Interfaces:**
- Consumes: yok (ilk task)
- Produces — `tasks-view.js` bu global fonksiyonları kullanacak:
  - `localDayISO(date?: Date) → string` (`'YYYY-MM-DD'`, yerel saat)
  - `addDaysISO(iso: string, delta: number) → string`
  - `splitTasks(rows: Task[], todayISO: string) → { today: Task[], carried: Task[] }`
  - `pickCurrentTask(tasks: Task[], now: Date) → Task | null`
  - `computeProgress(today: Task[], carried: Task[]) → { done: number, total: number }`
  - `dayLabel(dayISO: string, todayISO: string) → string`
  - `computeSnooze(task: Task, profile: object) → { start_time: string, end_time: string, day: string }`
  - `BREAK_MAP: object`

`Task` satırı Supabase'den geldiği şekliyle: `{ id, user_id, project_title, name, summary, cognitive_load, day, start_time, end_time, calendar_event_id, completed }`.

- [ ] **Step 1: Test dosyasını yaz (henüz kod yok, geçmesi beklenmiyor)**

`test/tasks-logic.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const L = require('../tasks-logic.js');

// ── localDayISO: UTC tuzağı ──
test('localDayISO yerel gunu verir, UTC kaymasi yapmaz', () => {
  // 26 Temmuz 01:30 yerel (UTC+3) → UTC'de 25 Temmuz 22:30.
  // toISOString() kullanilsaydi '2026-07-25' donerdi; dogrusu '2026-07-26'.
  const geceYarisiSonrasi = new Date(2026, 6, 26, 1, 30, 0);
  assert.strictEqual(L.localDayISO(geceYarisiSonrasi), '2026-07-26');
});

test('addDaysISO ay sinirini asar', () => {
  assert.strictEqual(L.addDaysISO('2026-07-01', -3), '2026-06-28');
  assert.strictEqual(L.addDaysISO('2026-07-26', 1), '2026-07-27');
});

// ── splitTasks ──
const rows = [
  { id: 1, day: '2026-07-24', completed: false, start_time: '2026-07-24T09:00:00+03:00', end_time: '2026-07-24T09:25:00+03:00' },
  { id: 2, day: '2026-07-24', completed: true,  start_time: '2026-07-24T10:00:00+03:00', end_time: '2026-07-24T10:25:00+03:00' },
  { id: 3, day: '2026-07-26', completed: false, start_time: '2026-07-26T09:00:00+03:00', end_time: '2026-07-26T09:25:00+03:00' },
  { id: 4, day: '2026-07-26', completed: true,  start_time: '2026-07-26T11:00:00+03:00', end_time: '2026-07-26T11:25:00+03:00' }
];

test('splitTasks bugunu ve devredenleri ayirir', () => {
  const { today, carried } = L.splitTasks(rows, '2026-07-26');
  assert.deepStrictEqual(today.map(t => t.id), [3, 4]);
  // gecmis gunun TAMAMLANMAMISI devreder; tamamlanmisi (id 2) gorunmez
  assert.deepStrictEqual(carried.map(t => t.id), [1]);
});

// ── pickCurrentTask ──
test('pickCurrentTask su an aktif olani secer', () => {
  const now = new Date('2026-07-26T09:10:00+03:00');
  const t = L.pickCurrentTask(L.splitTasks(rows, '2026-07-26').today, now);
  assert.strictEqual(t.id, 3);
});

test('pickCurrentTask aktif yoksa gelecekteki ilkini secer', () => {
  const now = new Date('2026-07-26T08:00:00+03:00');
  const t = L.pickCurrentTask(L.splitTasks(rows, '2026-07-26').today, now);
  assert.strictEqual(t.id, 3);
});

test('pickCurrentTask hepsi gecmisse en erken gecikmisi secer', () => {
  const now = new Date('2026-07-26T23:00:00+03:00');
  const gecikmis = [
    { id: 7, completed: false, start_time: '2026-07-26T15:00:00+03:00', end_time: '2026-07-26T15:25:00+03:00' },
    { id: 6, completed: false, start_time: '2026-07-26T09:00:00+03:00', end_time: '2026-07-26T09:25:00+03:00' }
  ];
  assert.strictEqual(L.pickCurrentTask(gecikmis, now).id, 6);
});

test('pickCurrentTask hepsi tamamlanmissa null doner', () => {
  const now = new Date('2026-07-26T12:00:00+03:00');
  const hepsiBitti = [{ id: 9, completed: true, start_time: '2026-07-26T09:00:00+03:00', end_time: '2026-07-26T09:25:00+03:00' }];
  assert.strictEqual(L.pickCurrentTask(hepsiBitti, now), null);
});

// ── computeProgress ──
test('computeProgress paydaya devredenleri de katar', () => {
  const { today, carried } = L.splitTasks(rows, '2026-07-26');
  assert.deepStrictEqual(L.computeProgress(today, carried), { done: 1, total: 3 });
});

// ── dayLabel ──
test('dayLabel notr gun etiketi verir', () => {
  assert.strictEqual(L.dayLabel('2026-07-25', '2026-07-26'), 'dün');
  assert.strictEqual(L.dayLabel('2026-07-23', '2026-07-26'), '3 gün önce');
});

// ── computeSnooze ──
const profil = { focusPeriod: 40, breakStyle: 'long-break', workHours: { start: '09:00', end: '18:00' } };

test('computeSnooze odak + mola kadar erteler, sureyi korur', () => {
  const task = { day: '2026-07-26', start_time: '2026-07-26T10:00:00+03:00', end_time: '2026-07-26T10:40:00+03:00' };
  const r = L.computeSnooze(task, profil);   // 40 + 15 = 55 dk
  assert.strictEqual(new Date(r.start_time).getHours(), 10);
  assert.strictEqual(new Date(r.start_time).getMinutes(), 55);
  // sure korunur: 40 dk
  assert.strictEqual((new Date(r.end_time) - new Date(r.start_time)) / 60000, 40);
  assert.strictEqual(r.day, '2026-07-26');
});

test('computeSnooze mesai sonunu asarsa yarinin mesai basina tasir', () => {
  const task = { day: '2026-07-26', start_time: '2026-07-26T17:30:00+03:00', end_time: '2026-07-26T18:10:00+03:00' };
  const r = L.computeSnooze(task, profil);   // 17:30 + 55 = 18:25 > 18:00
  const s = new Date(r.start_time);
  assert.strictEqual(r.day, '2026-07-27');
  assert.strictEqual(s.getHours(), 9);
  assert.strictEqual(s.getMinutes(), 0);
  assert.strictEqual((new Date(r.end_time) - s) / 60000, 40);
});

test('computeSnooze bos profilde 25+15=40 dk varsayilanini kullanir', () => {
  const task = { day: '2026-07-26', start_time: '2026-07-26T10:00:00+03:00', end_time: '2026-07-26T10:25:00+03:00' };
  const r = L.computeSnooze(task, {});
  assert.strictEqual(new Date(r.start_time).getHours(), 10);
  assert.strictEqual(new Date(r.start_time).getMinutes(), 40);
});

test('computeSnooze free mola stilinde sadece odak suresi kadar erteler', () => {
  const task = { day: '2026-07-26', start_time: '2026-07-26T10:00:00+03:00', end_time: '2026-07-26T10:30:00+03:00' };
  const r = L.computeSnooze(task, { focusPeriod: 30, breakStyle: 'free', workHours: { start: '09:00', end: '18:00' } });
  assert.strictEqual(new Date(r.start_time).getMinutes(), 30);  // 10:00 + 30 dk
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `node --test`
Expected: FAIL — `Cannot find module '../tasks-logic.js'`

- [ ] **Step 3: `tasks-logic.js` dosyasını yaz**

```js
/* ══════════════════════════════════════════════════════════════
   FocusAid — Bugün ekranı saf mantık katmanı
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   ══════════════════════════════════════════════════════════════ */

// n8n "Code in JavaScript" node'undaki breakMap ile BİREBİR AYNI olmalı.
// Biri değişirse diğeri de güncellenmeli (bkz. spec: Sonraya al).
const BREAK_MAP = { pomodoro: 5, 'long-break': 15, micro: 2, free: 0 };

const DEFAULT_FOCUS_PERIOD = 25;
const DEFAULT_BREAK_MINUTES = 15;
const CARRY_OVER_DAYS = 3;

/** Yerel saate göre 'YYYY-MM-DD'. toISOString() UTC verdiği için kullanılmaz. */
function localDayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  return localDayISO(new Date(y, m - 1, d + delta));
}

/** Bugünün görevleri (hepsi) + geçmişten devreden tamamlanmamışlar. */
function splitTasks(rows, todayISO) {
  const list = rows || [];
  return {
    today:   list.filter(r => r.day === todayISO),
    carried: list.filter(r => r.day < todayISO && !r.completed)
  };
}

/** Sıradaki görev: aktif olan → gelecekteki ilk → en erken gecikmiş → null */
function pickCurrentTask(tasks, now) {
  const pending = (tasks || [])
    .filter(t => !t.completed)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  if (!pending.length) return null;

  const active = pending.find(t => new Date(t.start_time) <= now && now < new Date(t.end_time));
  if (active) return active;

  const future = pending.find(t => new Date(t.start_time) > now);
  if (future) return future;

  return pending[0];
}

/** İlerleme paydası: bugün + devredenler (spec: Ekran anatomisi). */
function computeProgress(today, carried) {
  const all = [...(today || []), ...(carried || [])];
  return { done: all.filter(t => t.completed).length, total: all.length };
}

/** Nötr gün etiketi. Kırmızı/uyarı dili kullanılmaz (RSD koruması). */
function dayLabel(dayISO, todayISO) {
  const [ay, am, ad] = dayISO.split('-').map(Number);
  const [by, bm, bd] = todayISO.split('-').map(Number);
  const fark = Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
  if (fark <= 0) return '';
  if (fark === 1) return 'dün';
  return `${fark} gün önce`;
}

function _toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

/** Erteleme: bir tam odak bloğu kadar (odak + mola). n8n'deki step ile aynı. */
function computeSnooze(task, profile) {
  const p = profile || {};
  const focusPeriod = p.focusPeriod ?? DEFAULT_FOCUS_PERIOD;
  const breakMinutes = BREAK_MAP[p.breakStyle] ?? DEFAULT_BREAK_MINUTES;
  const snoozeMinutes = focusPeriod + breakMinutes;

  const start = new Date(task.start_time);
  const end = new Date(task.end_time);
  const durationMs = end - start;

  let newStart = new Date(start.getTime() + snoozeMinutes * 60000);

  const workEnd = _toMinutes(p.workHours?.end ?? '18:00');
  if (newStart.getHours() * 60 + newStart.getMinutes() > workEnd) {
    const workStart = _toMinutes(p.workHours?.start ?? '09:00');
    newStart = new Date(
      start.getFullYear(), start.getMonth(), start.getDate() + 1,
      Math.floor(workStart / 60), workStart % 60, 0, 0
    );
  }

  return {
    start_time: newStart.toISOString(),
    end_time: new Date(newStart.getTime() + durationMs).toISOString(),
    day: localDayISO(newStart)
  };
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BREAK_MAP, CARRY_OVER_DAYS,
    localDayISO, addDaysISO, splitTasks, pickCurrentTask,
    computeProgress, dayLabel, computeSnooze
  };
}
```

- [ ] **Step 4: Testleri çalıştır, hepsinin geçtiğini gör**

Run: `node --test`
Expected: PASS — 13 test, 0 fail. Hata varsa `tasks-logic.js` düzeltilir, test dosyası DEĞİŞTİRİLMEZ.

- [ ] **Step 5: Commit**

```bash
git add tasks-logic.js test/tasks-logic.test.js
git commit -m "feat: Bugün ekranı saf mantık katmanı + testleri"
```

---

### Task 2: Sekme, şablon ve boş durum

Ekranın iskeleti. Bu task sonunda sekme tıklanabilir ve veri olmadan boş durum görünür.

**Files:**
- Modify: `index_2.html` (sidebar navigasyonu, `<template id="tpl-today">`, `<script>` etiketleri, `loadPage` inits haritası)
- Create: `tasks-view.js`

**Interfaces:**
- Consumes: Task 1'den `localDayISO`, `splitTasks`, `pickCurrentTask`, `computeProgress`, `dayLabel`, `computeSnooze`
- Produces: `initToday()` — `loadPage('today')` tarafından çağrılır; `stopTodayTimer()` — sayfa değişiminde çağrılır

- [ ] **Step 1: `index_2.html`'e script etiketlerini ekle**

`<script src="config.js"></script>` satırının hemen ardına (`index_2.html:11`):

```html
<script src="tasks-logic.js"></script>
<script src="tasks-view.js"></script>
```

- [ ] **Step 2: Sidebar'a "Bugün" sekmesini ekle**

`index_2.html` içinde `<nav class="space-y-2">` bloğunda, `nav-calendar` butonunun ÜSTÜNE:

```html
<button onclick="loadPage('today')" id="nav-today" class="sidebar-item w-full text-left px-4 py-3 rounded-xl transition-all text-slate-600 hover:bg-slate-50 font-medium">🎯 Bugün</button>
```

- [ ] **Step 3: `tpl-today` şablonunu ekle**

`index_2.html` içinde `<template id="tpl-calendar">` bloğunun HEMEN ÖNÜNE:

```html
<template id="tpl-today">
<div class="animate-slide-in max-w-4xl mx-auto space-y-8 pb-10">

  <!-- İlerleme şeridi -->
  <div>
    <div class="flex justify-between items-end mb-3">
      <div>
        <h2 class="text-4xl font-extrabold text-slate-900 tracking-tight">Bugün</h2>
        <p class="text-slate-500 italic mt-1">Sırada ne var?</p>
      </div>
      <span id="today-progress-text" class="text-sm font-black text-indigo-600 tabular-nums">0/0</span>
    </div>
    <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
      <div id="today-progress-bar" class="h-full bg-indigo-500 rounded-full transition-all duration-500" style="width:0%"></div>
    </div>
  </div>

  <!-- Sıradaki görev kartı -->
  <div id="today-current"></div>

  <!-- Bugünün listesi -->
  <div id="today-list" class="space-y-2"></div>

  <!-- Boş durum -->
  <div id="today-empty" class="hidden text-center py-20">
    <div class="text-5xl mb-4">🌤️</div>
    <p class="text-slate-500 font-medium">Bugün için planlanmış mikro görev yok.</p>
    <button onclick="loadPage('chatbot')" class="mt-6 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 active:scale-95 transition-all">🧩 Bir görevi parçala</button>
  </div>

</div>
</template>
```

- [ ] **Step 4: `tasks-view.js` iskeletini yaz**

```js
/* ══════════════════════════════════════════════════════════════
   FocusAid — Bugün ekranı görünüm katmanı
   DOM render + Supabase/GAPI çağrıları. Saf hesaplar tasks-logic.js'te.
   ══════════════════════════════════════════════════════════════ */

const TodayState = { rows: [], today: [], carried: [], timer: null };

async function initToday() {
  stopTodayTimer();
  renderToday();
}

function stopTodayTimer() {
  if (TodayState.timer) { clearInterval(TodayState.timer); TodayState.timer = null; }
}

function renderToday() {
  const emptyEl = document.getElementById('today-empty');
  const listEl = document.getElementById('today-list');
  const currentEl = document.getElementById('today-current');
  if (!emptyEl || !listEl || !currentEl) return;

  const hepsi = [...TodayState.today, ...TodayState.carried];
  const bos = hepsi.length === 0;
  emptyEl.classList.toggle('hidden', !bos);
  listEl.classList.toggle('hidden', bos);
  currentEl.classList.toggle('hidden', bos);
}
```

- [ ] **Step 5: `loadPage` içine `today` init'ini bağla ve sayfa değişiminde timer'ı durdur**

`index_2.html` içindeki `loadPage` fonksiyonunda `inits` nesnesini şu hale getir:

```js
  const inits = {
    today:    () => typeof initToday       === 'function' && initToday(),
    calendar: () => typeof initCalendar    === 'function' && initCalendar(),
    profile:  () => typeof loadProfileToUI === 'function' && loadProfileToUI()
  };
```

Ve `loadPage` fonksiyonunun EN BAŞINA (`const main = ...` satırından hemen sonra) ekle:

```js
  if (typeof stopTodayTimer === 'function') stopTodayTimer();
```

- [ ] **Step 6: Tarayıcıda doğrula**

Run: `python -m http.server 3000` (repo kökünde), tarayıcıda `http://localhost:3000/auth.html` → giriş → sidebar'dan **🎯 Bugün**.
Expected: Sekme açılır, "Bugün 0/0" başlığı ve boş durum ("Bugün için planlanmış mikro görev yok") görünür. Konsolda hata YOK. Diğer sekmeler (Takvim, Parçalayıcı, Profil) hâlâ çalışıyor.

- [ ] **Step 7: Commit**

```bash
git add index_2.html tasks-view.js
git commit -m "feat: Bugün sekmesi, şablonu ve boş durumu"
```

---

### Task 3: Supabase'den yükleme ve render

**Files:**
- Modify: `tasks-view.js`

**Interfaces:**
- Consumes: Task 1'in tümü; `index_2.html`'deki global `sb` (Supabase istemcisi), `currentUser`, `showToast`
- Produces: `loadTasks()` — `TodayState.rows/today/carried` doldurur; `taskRowHTML(task, todayISO)` — liste satırı üretir

- [ ] **Step 1: Yükleme ve render fonksiyonlarını yaz**

`tasks-view.js` içinde `initToday`'i güncelle ve altına ekle:

```js
async function initToday() {
  stopTodayTimer();
  await loadTasks();
  renderToday();
  TodayState.timer = setInterval(renderToday, 60000);
}

async function loadTasks() {
  if (!currentUser) return;
  const todayISO = localDayISO();
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .gte('day', addDaysISO(todayISO, -CARRY_OVER_DAYS))
    .lte('day', todayISO)
    .order('start_time', { ascending: true });

  if (error) { showToast('Görevler yüklenemedi.', 'error'); return; }

  TodayState.rows = data || [];
  const { today, carried } = splitTasks(TodayState.rows, todayISO);
  TodayState.today = today;
  TodayState.carried = carried;
}

function saatAralik(task) {
  const f = d => new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${f(task.start_time)} – ${f(task.end_time)}`;
}

const YUK_ETIKET = { low: 'Hafif', medium: 'Orta', high: 'Ağır' };

function taskRowHTML(task, todayISO) {
  const etiket = dayLabel(task.day, todayISO);
  const rozet = etiket
    ? `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${etiket}</span>`
    : '';
  return `
    <div class="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 ${task.completed ? 'opacity-50' : ''}">
      <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')"
             class="w-5 h-5 accent-indigo-600 cursor-pointer shrink-0">
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-slate-700 truncate ${task.completed ? 'line-through' : ''}">${task.name || 'Görev'}</p>
        <p class="text-xs text-slate-400">${saatAralik(task)}</p>
      </div>
      ${rozet}
    </div>`;
}

function currentCardHTML(task) {
  if (!task) {
    return `<div class="glass-card p-10 bg-white text-center">
              <div class="text-4xl mb-3">🎉</div>
              <p class="font-bold text-slate-700">Bugünlük bu kadar!</p>
              <p class="text-slate-400 text-sm mt-1">Planladığın her şeyi bitirdin.</p>
            </div>`;
  }
  const yuk = YUK_ETIKET[task.cognitive_load] || '';
  const yukRozet = yuk
    ? `<span class="adhd-badge" style="background:#eef2ff;color:#4f46e5;border-color:#c7d2fe">${yuk}</span>`
    : '';
  return `
    <div class="glass-card p-10 bg-white shadow-2xl border-l-4 border-indigo-500 space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sırada</p>
          <h3 class="text-3xl font-extrabold text-slate-900 leading-tight">${task.name || 'Görev'}</h3>
          ${task.summary ? `<p class="text-slate-500 mt-2 leading-relaxed">${task.summary}</p>` : ''}
          <p class="text-sm font-bold text-indigo-600 mt-3">${saatAralik(task)}</p>
        </div>
        ${yukRozet}
      </div>
      <div class="flex gap-4">
        <button onclick="toggleTask('${task.id}')" class="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">✓ Tamamlandı</button>
        <button onclick="snoozeTask('${task.id}')" class="flex-1 bg-slate-50 text-slate-600 px-6 rounded-2xl font-bold border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all">Sonraya al</button>
      </div>
    </div>`;
}
```

- [ ] **Step 2: `renderToday`'i gerçek render yapacak şekilde değiştir**

`tasks-view.js` içindeki `renderToday`'i tamamen şununla değiştir:

```js
function renderToday() {
  const emptyEl = document.getElementById('today-empty');
  const listEl = document.getElementById('today-list');
  const currentEl = document.getElementById('today-current');
  const barEl = document.getElementById('today-progress-bar');
  const textEl = document.getElementById('today-progress-text');
  if (!emptyEl || !listEl || !currentEl) return;

  const todayISO = localDayISO();
  const hepsi = [...TodayState.carried, ...TodayState.today];
  const bos = hepsi.length === 0;

  emptyEl.classList.toggle('hidden', !bos);
  listEl.classList.toggle('hidden', bos);
  currentEl.classList.toggle('hidden', bos);
  if (bos) { if (textEl) textEl.textContent = '0/0'; if (barEl) barEl.style.width = '0%'; return; }

  const { done, total } = computeProgress(TodayState.today, TodayState.carried);
  if (textEl) textEl.textContent = `${done}/${total}`;
  if (barEl) barEl.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';

  currentEl.innerHTML = currentCardHTML(pickCurrentTask(hepsi, new Date()));
  listEl.innerHTML = hepsi.map(t => taskRowHTML(t, todayISO)).join('');
}
```

- [ ] **Step 3: Test verisi ekle**

Supabase Dashboard → SQL Editor'de çalıştır (`<KULLANICI_ID>` yerine kendi `auth.users` id'ni yaz; `select id, email from auth.users;` ile bulabilirsin):

```sql
insert into public.tasks (user_id, project_title, name, summary, cognitive_load, day, start_time, end_time, completed) values
  ('<KULLANICI_ID>', 'Test Projesi', 'Dünden kalan görev', 'Devreden görev testi',      'medium', current_date - 1, (current_date - 1 + time '10:00') at time zone 'Europe/Istanbul', (current_date - 1 + time '10:25') at time zone 'Europe/Istanbul', false),
  ('<KULLANICI_ID>', 'Test Projesi', 'Sabah görevi',      'Tamamlanmış görev testi',    'low',    current_date,     (current_date + time '09:00') at time zone 'Europe/Istanbul',     (current_date + time '09:25') at time zone 'Europe/Istanbul',     true),
  ('<KULLANICI_ID>', 'Test Projesi', 'Öğleden sonra',     'Sıradaki görev testi',       'high',   current_date,     (current_date + time '15:00') at time zone 'Europe/Istanbul',     (current_date + time '15:40') at time zone 'Europe/Istanbul',     false);
```

- [ ] **Step 4: Tarayıcıda doğrula**

Sayfayı yenile → **Bugün** sekmesi.
Expected: İlerleme `1/3` ve çubuk üçte bir dolu. Sıradaki görev kartında saate göre doğru görev. Listede 3 satır: devreden görevde gri **"dün"** rozeti (kırmızı YOK), tamamlanmış görev soluk ve üstü çizili. Konsolda hata yok.

- [ ] **Step 5: Commit**

```bash
git add tasks-view.js
git commit -m "feat: Bugün ekranı Supabase'den görevleri yükleyip render ediyor"
```

---

### Task 4: Tamamlama ve geri alma

**Files:**
- Modify: `tasks-view.js`

**Interfaces:**
- Consumes: `TodayState`, `renderToday`, `sb`, `showToast`
- Produces: `toggleTask(id)` — hem tamamlar hem geri alır

- [ ] **Step 1: `toggleTask`'ı yaz**

`tasks-view.js` sonuna ekle:

```js
function findTask(id) {
  return TodayState.rows.find(t => String(t.id) === String(id));
}

async function toggleTask(id) {
  const task = findTask(id);
  if (!task) return;

  const yeniDurum = !task.completed;
  task.completed = yeniDurum;   // iyimser: UI hemen güncellenir
  renderToday();

  const { error } = await sb.from('tasks').update({ completed: yeniDurum }).eq('id', task.id);
  if (error) {
    task.completed = !yeniDurum;   // geri al
    renderToday();
    showToast('Kaydedilemedi, tekrar dene.', 'error');
    return;
  }
}
```

- [ ] **Step 2: Tarayıcıda doğrula**

Bugün sekmesinde bir görevin onay kutusuna tıkla.
Expected: Satır anında soluklaşıp üstü çizilir, ilerleme çubuğu artar, sıradaki görev kartı bir sonrakine geçer. Sayfayı yenile → değişiklik korunmuş (Supabase'e yazılmış). Tekrar tıkla → geri alınır ve yenilemeden sonra da geri alınmış kalır.

- [ ] **Step 3: Commit**

```bash
git add tasks-view.js
git commit -m "feat: görev tamamlama ve geri alma (iyimser güncelleme)"
```

---

### Task 5: Google Calendar ✓ senkronu

Best-effort. Bu task'ın en önemli davranışı: **takvim çalışmasa bile görev tamamlama çalışmaya devam eder.**

**Files:**
- Modify: `tasks-view.js`

**Interfaces:**
- Consumes: global `gapi`, `AppState.googleAccessToken`, `showToast`
- Produces: `syncCalendarMark(task, done)` — hiçbir zaman throw etmez

- [ ] **Step 1: `syncCalendarMark`'ı yaz**

`tasks-view.js` sonuna ekle:

```js
/** Takvim etkinliğini işaretler. Best-effort: hata YUTULUR, çağıran akış bozulmaz. */
async function syncCalendarMark(task, done) {
  if (!task.calendar_event_id) return;
  if (!AppState.googleAccessToken || !AppState.gapiReady) {
    showToast('Görev kaydedildi, takvim bağlı değil.', 'info');
    return;
  }
  try {
    const temizAd = (task.name || 'Görev').replace(/^✓\s*/, '');
    await gapi.client.calendar.events.patch({
      calendarId: 'primary',
      eventId: task.calendar_event_id,
      resource: done
        ? { summary: '✓ ' + temizAd, colorId: '10' }   // 10 = yeşil
        : { summary: temizAd, colorId: null }
    });
    AppState.calendar?.refetchEvents();
  } catch (e) {
    console.warn('Takvim güncellenemedi:', e);
    showToast('Görev kaydedildi, takvim güncellenemedi.', 'info');
  }
}
```

- [ ] **Step 2: `toggleTask`'ın sonuna senkron çağrısını ekle**

`toggleTask` içindeki `if (error) { ... return; }` bloğunun HEMEN ARDINA:

```js
  syncCalendarMark(task, yeniDurum);   // await YOK: ana akışı bekletmez
```

- [ ] **Step 3: Mutlu yolu doğrula**

n8n ile gerçek bir görev parçala (böylece `calendar_event_id` dolu bir satır oluşsun) → Bugün sekmesinden tamamla.
Expected: Google Calendar'da etkinliğin başlığı `✓ ...` olur ve rengi yeşile döner. Geri alınca `✓ ` kalkar, renk eski haline döner.

- [ ] **Step 4: HATA YOLUNU doğrula (bu task'ın asıl testi)**

Tarayıcı konsolunda `AppState.googleAccessToken = null` çalıştır, sonra bir görevi tamamla.
Expected: Görev **yine de tamamlanır**, Supabase'e yazılır, ilerleme çubuğu artar. Yalnızca "Görev kaydedildi, takvim bağlı değil." bilgi toast'ı çıkar. Sayfayı yenile → tamamlama korunmuş. **Supabase yazımı geri alınmamış olmalı.**

- [ ] **Step 5: Commit**

```bash
git add tasks-view.js
git commit -m "feat: tamamlanan görev takvimde ✓ ve yeşil olarak işaretleniyor (best-effort)"
```

---

### Task 6: Sonraya al

**Files:**
- Modify: `tasks-view.js`

**Interfaces:**
- Consumes: Task 1'den `computeSnooze`; `syncCalendarMark` deseni
- Produces: `snoozeTask(id)`

- [ ] **Step 1: `snoozeTask`'ı yaz**

`tasks-view.js` sonuna ekle:

```js
async function snoozeTask(id) {
  const task = findTask(id);
  if (!task) return;

  const profile = JSON.parse(localStorage.getItem('focusaid_profile') || '{}');
  const yeni = computeSnooze(task, profile);

  const eski = { start_time: task.start_time, end_time: task.end_time, day: task.day };
  Object.assign(task, yeni);   // iyimser
  const todayISO = localDayISO();
  const { today, carried } = splitTasks(TodayState.rows, todayISO);
  TodayState.today = today; TodayState.carried = carried;
  renderToday();

  const { error } = await sb.from('tasks')
    .update({ start_time: yeni.start_time, end_time: yeni.end_time, day: yeni.day })
    .eq('id', task.id);

  if (error) {
    Object.assign(task, eski);   // geri al
    const g = splitTasks(TodayState.rows, todayISO);
    TodayState.today = g.today; TodayState.carried = g.carried;
    renderToday();
    showToast('Ertelenemedi, tekrar dene.', 'error');
    return;
  }

  snoozeCalendarEvent(task, yeni);
  const dk = (profile.focusPeriod ?? 25) + (BREAK_MAP[profile.breakStyle] ?? 15);
  showToast(`${dk} dakika sonraya alındı.`, 'success');
}

/** Takvim etkinliğini kaydırır. Best-effort: hata YUTULUR. */
async function snoozeCalendarEvent(task, yeni) {
  if (!task.calendar_event_id) return;
  if (!AppState.googleAccessToken || !AppState.gapiReady) return;
  try {
    await gapi.client.calendar.events.patch({
      calendarId: 'primary',
      eventId: task.calendar_event_id,
      resource: {
        start: { dateTime: yeni.start_time, timeZone: CONFIG.TIMEZONE },
        end:   { dateTime: yeni.end_time,   timeZone: CONFIG.TIMEZONE }
      }
    });
    AppState.calendar?.refetchEvents();
  } catch (e) {
    console.warn('Takvim etkinliği kaydırılamadı:', e);
  }
}
```

- [ ] **Step 2: Normal ertelemeyi doğrula**

Profil sekmesinde odak süresini **40 dk**, mola stilini **Uzun Mola (15 dk)** yap ve kaydet. Bugün sekmesine dön, gündüz saatli bir görevde "Sonraya al".
Expected: Görev saati **55 dk** ileri kayar (40+15), süresi değişmez. Toast "55 dakika sonraya alındı." der. Sayfayı yenile → yeni saat korunmuş. Takvimdeki etkinlik de kaymış.

- [ ] **Step 3: Profile duyarlılığı doğrula**

Profilde mola stilini **Pomodoro (5 dk)** yap, kaydet, tekrar bir görev ertele.
Expected: Bu kez **45 dk** (40+5) kayar ve toast "45 dakika sonraya alındı." der.

- [ ] **Step 4: Mesai taşmasını doğrula**

Test satırını mesai sonuna yakın bir saate çek:

```sql
update public.tasks set start_time = (current_date + time '17:30') at time zone 'Europe/Istanbul',
                        end_time   = (current_date + time '18:10') at time zone 'Europe/Istanbul'
where name = 'Öğleden sonra';
```

Sayfayı yenile, o görevde "Sonraya al".
Expected: Görev **yarına**, profildeki mesai başlangıcına (`09:00`) taşınır; `day` bir gün ileri gider. Ertelenen görev artık bugünün listesinde görünmez (yarına ait), ilerleme paydası bir azalır.

- [ ] **Step 5: Commit**

```bash
git add tasks-view.js
git commit -m "feat: profile göre erteleme (odak + mola) ve takvim kaydırma"
```

---

### Task 7: Açılış sayfası ve ikiz dosya

**Files:**
- Modify: `index_2.html` (açılış sayfası)
- Modify: `index.html` (Task 2–6'daki tüm `index_2.html` değişiklikleri)

- [ ] **Step 1: Açılış sayfasını `today` yap**

`index_2.html` sonundaki `DOMContentLoaded` bloğunda:

```js
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 FocusAid başlatılıyor...');
  loadPage('today');
});
```

- [ ] **Step 2: `index.html`'i `index_2.html` ile eşitle**

İkisi birebir ikiz olduğu için (Task 1 öncesi hash'leri aynıydı) en güvenli yol kopyalamaktır:

```bash
cp index_2.html index.html
```

- [ ] **Step 3: İkizliği doğrula**

Run: `git diff --stat index.html` ve aşağıdaki karşılaştırma:

```bash
diff index.html index_2.html && echo "IKIZ: FARK YOK"
```
Expected: `IKIZ: FARK YOK`

- [ ] **Step 4: Tarayıcıda doğrula**

`http://localhost:3000/auth.html` → giriş.
Expected: Giriş sonrası doğrudan **Bugün** ekranı açılır (takvim değil). Sidebar'da "Bugün" sekmesi aktif görünür. Takvim sekmesine geçip geri dön → liste tekrar yüklenir, konsolda hata yok.

- [ ] **Step 5: Commit**

```bash
git add index_2.html index.html
git commit -m "feat: açılış sayfası Bugün ekranı, index.html ikizi eşitlendi"
```

---

### Task 8: Kapanış doğrulaması

Tüm senaryoların bir arada çalıştığının kanıtı. Yeni kod yok.

- [ ] **Step 1: Birim testleri koştur**

Run: `node --test`
Expected: 13 test PASS.

- [ ] **Step 2: Spec'in doğrulama listesini baştan sona geç**

`docs/superpowers/specs/2026-07-26-gorevlerim-ekrani-design.md` → "Doğrulama" bölümündeki 7 senaryonun hepsi tek oturumda tekrar edilir:

1. Boş liste → boş durum ekranı (test satırlarını geçici sil: `delete from public.tasks where project_title = 'Test Projesi';`)
2. Sadece devreden görevler → gri gün rozeti, kırmızı/uyarı yok
3. Karışık gün → "sıradaki görev" doğru seçiliyor
4. Hepsi tamamlanmış → kutlama kartı, ilerleme tam
5. Takvim bağlı değilken tamamlama → Supabase yazıyor, bilgi toast'ı çıkıyor
6. Erteleme mesai sonunu aşınca yarına taşınıyor + profil değişince erteleme miktarı değişiyor
7. Tamamlamayı geri alma → takvimdeki `✓ ` ve renk geri dönüyor

- [ ] **Step 3: RSD kontrolü**

Ekranda gecikmiş görevler varken görsel tarama yap.
Expected: Hiçbir yerde kırmızı renk, "GECİKTİ" damgası, ünlem ikonu, ayrı "Gecikenler" başlığı veya gecikmiş sayacı YOK. Yalnızca nötr gri gün rozetleri.

- [ ] **Step 4: Test verisini temizle ve commit**

```sql
delete from public.tasks where project_title = 'Test Projesi';
```

```bash
git add -A
git commit -m "test: Bugün ekranı kapanış doğrulaması"
```
