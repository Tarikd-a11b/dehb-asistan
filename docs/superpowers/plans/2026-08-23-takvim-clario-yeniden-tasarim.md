# Takvim Clario Yeniden Tasarım — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FocusAid'in Takvim sayfasını Clario referansındaki gibi üç kolonlu (mini ay takvimi + haftalık özet + büyük hafta görünümü) hale getirmek ve hafta görünümündeki görev kartlarını her zaman okunaklı kılmak.

**Architecture:** Saf tarih hesapları yeni bir `calendar-logic.js` dosyasına çıkarılıp `node --test` ile test edilir. DOM kodu `index.html` içinde, mevcut `initCalendar` fonksiyonunun yanında kalır — çünkü CLAUDE.md `index.html`'i bilinçli olarak "tek uygulama dosyası" ilan ediyor. Mini takvim ikinci bir FullCalendar örneği değil, saf vanilla-JS bir grid'dir.

**Tech Stack:** vanilla HTML/JS, Tailwind (CDN), FullCalendar v6.1.8, Supabase JS v2, `node --test`

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-23-takvim-clario-yeniden-tasarim-design.md` (commit `b718dd9`)
- Repo kökü: `C:\Users\dmrta\Desktop\Projeler\FocusAid\DehbProject\FocusAid` — **her task'ın ilk adımı bu dizine `cd` etmek ve `git branch --show-current` ile `main`'de olduğunu doğrulamaktır.**
- Testler kök dizinden **argümansız** çalıştırılır: `node --test`. `node --test test/` Windows'ta `MODULE_NOT_FOUND` verir.
- Yerel sunucu: `python serve.py` → `http://localhost:3000/auth.html`. **`localhost` kullan, `127.0.0.1` değil** (Supabase PKCE origin'e bağlı).
- Saf hesap `*-logic.js`'e, DOM ve ağ çağrısı `index.html`/`*-view.js`'e. Bu ayrım korunur.
- `config.js` **gitignored** — asla commit edilmez, asla `git add .` kullanılmaz; dosyalar tek tek eklenir.
- Commit ve push **yalnızca kullanıcı söylediğinde**. Bu plandaki commit adımları yereldir; push adımı yoktur.
- Renk dili (spec §4): hafif=emerald-600 `#059669`, orta=amber-600 `#d97706`, ağır=rose-600 `#e11d48`, GCal-özel=purple-600 `#9333ea`, mola=teal-600 `#0d9488`. Dolgu doygun, yazı beyaz `#ffffff`.

### Spec'ten bilinçli sapma

Spec §2 haftalık özeti "Pzt–Paz" olarak tanımlıyor. Ancak büyük takvim `locale: 'tr'` ile **Pazar-başlangıçlı** render ediliyor (ekranda `PAZ PZT SAL ÇAR PER CUM CMT`). Özet ile ekranda görünen hafta farklı olursa kullanıcı için kafa karıştırıcı olur. Bu planda **haftalar Pazar–Cumartesi** alınır; mini takvim ızgarası da aynı hizada olur.

---

### Task 1: `calendar-logic.js` — saf tarih ızgarası hesabı

**Files:**
- Create: `calendar-logic.js`
- Create: `test/calendar-logic.test.js`
- Modify: `index.html:27` (script etiketi eklenecek)

**Interfaces:**
- Consumes: yok (tamamen bağımsız modül)
- Produces:
  - `buildMonthGrid(year, month) -> Array<{iso: string, day: number, inMonth: boolean}>` — 42 hücre, `month` 0-11
  - `monthLabel(year, month) -> string` — örn. `'Ağustos 2026'`
  - `shiftMonth(year, month, delta) -> {year: number, month: number}`
  - `weekRangeISO(dateISO) -> {start: string, end: string}` — Pazar–Cumartesi

- [ ] **Step 1: Repo dizinine geç ve branch'i doğrula**

```bash
cd "C:/Users/dmrta/Desktop/Projeler/FocusAid/DehbProject/FocusAid"
git branch --show-current
git status --short
```

Beklenen: `main`, çalışma ağacı temiz (ya da yalnızca bu plandan beklenen değişiklikler).

- [ ] **Step 2: Başarısız testi yaz**

`test/calendar-logic.test.js` dosyasını oluştur:

```js
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
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu doğrula**

```bash
node --test
```

Beklenen: FAIL — `Cannot find module '../calendar-logic.js'`

- [ ] **Step 4: Minimal implementasyonu yaz**

`calendar-logic.js` dosyasını oluştur:

```js
/* ══════════════════════════════════════════════════════════════
   FocusAid — Takvim saf mantık katmanı
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   Testler: node --test   (kök dizinden, ARGÜMANSIZ)
   ══════════════════════════════════════════════════════════════ */

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                   'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/**
 * Date → 'YYYY-MM-DD' (yerel saat).
 * tasks-logic.js'teki localDayISO ile aynı işi yapar; bu modülün tek başına
 * require edilebilmesi için burada tekrar tanımlı. Dört satırlık kopya,
 * dosyalar arası global bağımlılıktan iyi.
 * toISOString() KULLANILMAZ: UTC verir, UTC+3'te günü bir geri kaydırır.
 */
function _iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Bir ayın 6x7'lik takvim ızgarası. Hafta PAZAR başlar (büyük takvim
 * locale:'tr' ile Pazar-başlangıçlı render ediliyor, hizalı olmalı).
 * Baştaki ve sondaki taşma günleri inMonth:false ile işaretlenir.
 * Ay uzunluğu ve artık yıl Date yapıcısının kendi taşma davranışına bırakılmış.
 */
function buildMonthGrid(year, month) {
  const kayma = new Date(year, month, 1).getDay();   // 0 = Pazar
  const hucreler = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - kayma + i);
    hucreler.push({ iso: _iso(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return hucreler;
}

function monthLabel(year, month) {
  return `${AY_ADLARI[month]} ${year}`;
}

function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** dateISO'yu içeren haftanın (Pazar–Cumartesi) sınırları. */
function weekRangeISO(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const gun = new Date(y, m - 1, d);
  const bas = new Date(y, m - 1, d - gun.getDay());
  const son = new Date(bas.getFullYear(), bas.getMonth(), bas.getDate() + 6);
  return { start: _iso(bas), end: _iso(son) };
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AY_ADLARI, buildMonthGrid, monthLabel, shiftMonth, weekRangeISO };
}
```

- [ ] **Step 5: Testleri çalıştır, geçtiğini doğrula**

```bash
node --test
```

Beklenen: PASS — yeni 11 test dahil tüm testler geçer (mevcut `tasks-logic` ve `doc-intake-logic` testleri bozulmamalı).

- [ ] **Step 6: Script etiketini `index.html`'e ekle**

`index.html:27` satırındaki:

```html
<script src="tasks-logic.js"></script>
```

satırının **hemen altına** ekle:

```html
<script src="calendar-logic.js"></script>
```

- [ ] **Step 7: Commit**

```bash
git add calendar-logic.js test/calendar-logic.test.js index.html
git commit -m "Add calendar-logic.js: pure month-grid and week-range helpers"
```

---

### Task 2: Takvim sayfasının üç kolonlu iskeleti

**Files:**
- Modify: `index.html:342-345` (`tpl-calendar` içindeki kolon sarmalayıcısı)

**Interfaces:**
- Consumes: yok
- Produces: DOM bağlanma noktaları — sonraki task'lar bu id'leri hedefler:
  - `#mini-calendar-label`, `#mini-calendar-grid`, `#mini-prev`, `#mini-next`
  - `#week-overview-text`, `#week-overview-bar`
  - `#calendar` (mevcut, korunuyor)

- [ ] **Step 1: Repo dizinine geç ve branch'i doğrula**

```bash
cd "C:/Users/dmrta/Desktop/Projeler/FocusAid/DehbProject/FocusAid"
git branch --show-current
```

Beklenen: `main`

- [ ] **Step 2: Yan paneli ekle**

`index.html` içinde şu bloğu bul (342-345 satırları civarı):

```html
  <div class="flex flex-col xl:flex-row gap-10">
    <div class="flex-1 min-w-[350px] glass-card p-6 bg-white/90 shadow-2xl">
      <div id="calendar"></div>
    </div>
```

Şununla değiştir:

```html
  <div class="flex flex-col xl:flex-row gap-6">
    <!-- Takvim yan paneli: mini ay takvimi + haftalık özet + yeni görev.
         Clario referansındaki sol kolonun karşılığı. Ana sidebar'dan ayrı;
         bu panel yalnızca Takvim sayfasına ait. -->
    <aside class="w-full xl:w-[260px] shrink-0 space-y-5">
      <div class="glass-card p-5">
        <div class="flex items-center justify-between mb-4">
          <p id="mini-calendar-label" class="text-sm font-bold" style="color:var(--text-main)">—</p>
          <div class="flex gap-1">
            <button id="mini-prev" class="w-7 h-7 rounded-full grid place-items-center text-xs font-bold transition-colors"
                    style="background:var(--card-hover-bg);color:var(--text-soft)" aria-label="Önceki ay">‹</button>
            <button id="mini-next" class="w-7 h-7 rounded-full grid place-items-center text-xs font-bold transition-colors"
                    style="background:var(--card-hover-bg);color:var(--text-soft)" aria-label="Sonraki ay">›</button>
          </div>
        </div>
        <div id="mini-calendar-grid" class="grid grid-cols-7 gap-y-1 text-center"></div>
      </div>

      <div class="glass-card p-5">
        <p class="text-[10px] font-black uppercase tracking-widest mb-3" style="color:var(--text-soft)">Bu Hafta</p>
        <p id="week-overview-text" class="text-sm font-bold mb-3" style="color:var(--text-main)">—</p>
        <div class="h-2 rounded-full overflow-hidden" style="background:var(--card-hover-bg)">
          <div id="week-overview-bar" class="h-full rounded-full transition-all duration-500"
               style="width:0%;background:var(--indigo-main)"></div>
        </div>
      </div>

      <button onclick="openTaskForm(localDayISO())"
              class="w-full py-3 rounded-2xl font-bold text-white transition-all active:scale-95"
              style="background:var(--indigo-main)">+ Yeni Görev</button>
    </aside>

    <div class="flex-1 min-w-[350px] glass-card p-6 shadow-2xl">
      <div id="calendar"></div>
    </div>
```

**Not:** eski `bg-white/90` sınıfı kaldırıldı — `glass-card` zaten `var(--glass-white)` kullanıyor, sabit beyaz koyu temayı bozuyordu.

- [ ] **Step 3: Tarayıcıda doğrula**

Sunucuyu başlat (zaten çalışıyorsa atla):

```bash
python serve.py
```

`http://localhost:3000/auth.html` → giriş → Takvim sekmesi.

Beklenen: Büyük takvimin solunda iki boş kart görünüyor (biri "—" başlıklı ve boş ızgaralı, biri "Bu Hafta / —" yazan) ve altlarında "+ Yeni Görev" butonu. Büyük takvim hâlâ normal çalışıyor. Kartların içi bu aşamada **kasıtlı olarak boş** — doldurma Task 3 ve 4'te.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add Takvim side panel scaffold: mini calendar, week overview, new-task button"
```

---

### Task 3: Mini ay takvimi — render ve büyük takvimle senkron

**Files:**
- Modify: `index.html` — `initCalendarUnsafe`'in hemen üstüne yeni fonksiyonlar; `initCalendar` ve `datesSet` içine çağrı

**Interfaces:**
- Consumes: `buildMonthGrid`, `monthLabel`, `shiftMonth` (Task 1); `#mini-calendar-*` DOM id'leri (Task 2); mevcut `AppState.calendar`, `localDayISO` (tasks-logic.js)
- Produces:
  - `MiniState = {year: number, month: number, selected: string}`
  - `renderMiniCalendar()` — ızgarayı çizer, hata YUTAR
  - `syncMiniCalendar(dateISO)` — büyük takvim gezinince çağrılır, yalnızca ay değiştiyse yeniden çizer

- [ ] **Step 1: Repo dizinine geç ve branch'i doğrula**

```bash
cd "C:/Users/dmrta/Desktop/Projeler/FocusAid/DehbProject/FocusAid"
git branch --show-current
```

Beklenen: `main`

- [ ] **Step 2: Mini takvim fonksiyonlarını ekle**

`index.html` içinde `// ── TAKVİM ──` yorumunu ve altındaki `function initCalendar()` satırını bul. **`function initCalendar()`'ın hemen ÜSTÜNE** şunu ekle:

```js
// ── MİNİ AY TAKVİMİ ──
// İkinci bir FullCalendar örneği DEĞİL: bu iş için gereksiz ağır olurdu.
// Saf tarih hesabı calendar-logic.js'te, burada yalnızca DOM var.
const MiniState = { year: 0, month: 0, selected: '' };

// İki harf: tek harfte üç 'P' ve iki 'C' çıkıp ayırt edilemiyordu.
const MINI_GUN_BASLIKLARI = ['Pa', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];

/** Mini takvimi çizer. Hata YUTULUR: yan panel çökse de büyük takvim çalışır. */
function renderMiniCalendar() {
  try {
    const grid = document.getElementById('mini-calendar-grid');
    const label = document.getElementById('mini-calendar-label');
    if (!grid || !label) return;

    label.textContent = monthLabel(MiniState.year, MiniState.month);
    const bugun = localDayISO();

    const basliklar = MINI_GUN_BASLIKLARI
      .map(g => `<div class="text-[10px] font-black pb-1" style="color:var(--text-soft)">${g}</div>`)
      .join('');

    const hucreler = buildMonthGrid(MiniState.year, MiniState.month).map(c => {
      const secili = c.iso === MiniState.selected;
      const buguneMi = c.iso === bugun;
      let stil = 'color:var(--text-soft)';
      if (!c.inMonth) stil = 'color:var(--text-soft);opacity:.35';
      if (buguneMi) stil = 'color:var(--indigo-main);font-weight:800';
      if (secili) stil = 'background:var(--indigo-main);color:#fff;font-weight:800';
      return `<button type="button" data-iso="${c.iso}"
                class="mini-day w-7 h-7 mx-auto rounded-full text-[11px] transition-colors"
                style="${stil}">${c.day}</button>`;
    }).join('');

    grid.innerHTML = basliklar + hucreler;

    grid.querySelectorAll('.mini-day').forEach(b => {
      b.onclick = () => {
        const iso = b.dataset.iso;
        MiniState.selected = iso;
        AppState.calendar?.gotoDate(iso);
        renderMiniCalendar();
      };
    });
  } catch (e) {
    console.warn('[Mini Takvim] çizilemedi:', e);
  }
}

/**
 * Büyük takvim gezinince mini takvimi hizalar.
 * SONSUZ DÖNGÜ KORUMASI: yalnızca görünen AY değiştiyse yeniden çizer.
 * (gotoDate → datesSet → syncMiniCalendar zinciri her seferinde yeniden
 * çizseydi tıklama sonsuz döngüye girerdi.)
 */
function syncMiniCalendar(dateISO) {
  try {
    const [y, m] = dateISO.split('-').map(Number);
    if (MiniState.year === y && MiniState.month === m - 1) return;
    MiniState.year = y;
    MiniState.month = m - 1;
    renderMiniCalendar();
  } catch (e) {
    console.warn('[Mini Takvim] senkron edilemedi:', e);
  }
}
```

- [ ] **Step 3: `initCalendar` içinden başlat**

`initCalendar` fonksiyonunu bul:

```js
function initCalendar() {
  const el = document.getElementById('calendar');
  if (!el) return;
  try {
    initCalendarUnsafe(el);
  } catch (e) {
```

`initCalendarUnsafe(el);` satırının **hemen altına** ekle:

```js
    const bugun = localDayISO();
    const [by, bm] = bugun.split('-').map(Number);
    MiniState.year = by;
    MiniState.month = bm - 1;
    MiniState.selected = bugun;
    renderMiniCalendar();
```

- [ ] **Step 4: `datesSet` içinden senkronu bağla**

`initCalendarUnsafe` içindeki mevcut `datesSet` callback'ini bul:

```js
    datesSet(info) {
      AppState.calendar?.setOption('height', info.view.type === 'timeGridWeek' ? 700 : 'auto');
    },
```

Şununla değiştir:

```js
    datesSet(info) {
      AppState.calendar?.setOption('height', info.view.type === 'timeGridWeek' ? 700 : 'auto');
      // info.start görünen aralığın ilk günü; ay görünümünde önceki aya
      // taşabildiği için ortadaki günü baz alıyoruz.
      const orta = new Date((info.start.getTime() + info.end.getTime()) / 2);
      syncMiniCalendar(localDayISO(orta));
    },
```

- [ ] **Step 5: Tarayıcıda doğrula**

`http://localhost:3000/auth.html` → Takvim sekmesi. Sayfayı yenile (serve.py önbelleksiz, hard-refresh gerekmez).

Doğrulanacaklar:
1. Mini takvimde içinde bulunulan ay, gün başlıkları ve gün numaraları görünüyor.
2. Bugün mor renkte vurgulu.
3. Mini takvimde başka bir aya ait bir güne tıkla → büyük takvim o tarihe atlıyor, tıklanan gün dolu mor daire oluyor.
4. Büyük takvimde `›` ile bir sonraki aya git → mini takvim de o aya geçiyor.
5. DevTools Console'da `[Mini Takvim]` uyarısı **yok**.

- [ ] **Step 6: `mini-prev` / `mini-next` butonlarını bağla**

`renderMiniCalendar` fonksiyonunda `grid.querySelectorAll('.mini-day')...` bloğunun **hemen altına**, `} catch (e) {` satırından önce ekle:

```js
    const prev = document.getElementById('mini-prev');
    const next = document.getElementById('mini-next');
    if (prev) prev.onclick = () => {
      Object.assign(MiniState, shiftMonth(MiniState.year, MiniState.month, -1));
      renderMiniCalendar();
    };
    if (next) next.onclick = () => {
      Object.assign(MiniState, shiftMonth(MiniState.year, MiniState.month, 1));
      renderMiniCalendar();
    };
```

- [ ] **Step 7: Ok butonlarını doğrula**

Sayfayı yenile → Takvim. Mini takvimdeki `‹` ve `›` butonlarına bas.

Beklenen: mini takvim ay değiştiriyor, **büyük takvim yerinde kalıyor** (ok'lar yalnızca göz atma içindir; büyük takvimi ancak bir güne tıklayınca taşır).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "Add mini month calendar with two-way sync to main calendar"
```

---

### Task 4: Haftalık özet kartı

**Files:**
- Modify: `index.html` — `renderMiniCalendar`'ın altına yeni fonksiyon; `initCalendar` içine çağrı

**Interfaces:**
- Consumes: `weekRangeISO` (Task 1); `#week-overview-text`, `#week-overview-bar` (Task 2); mevcut `sb` (Supabase client), `currentUser`, `localDayISO`
- Produces: `renderWeekOverview()` — async, hata YUTAR

- [ ] **Step 1: Repo dizinine geç ve branch'i doğrula**

```bash
cd "C:/Users/dmrta/Desktop/Projeler/FocusAid/DehbProject/FocusAid"
git branch --show-current
```

Beklenen: `main`

- [ ] **Step 2: Özet fonksiyonunu ekle**

`syncMiniCalendar` fonksiyonunun **hemen altına** ekle:

```js
// ── HAFTALIK ÖZET ──
/**
 * Bugünü içeren haftanın (Paz–Cmt) tamamlanma oranı.
 * Büyük takvimin gezinmesinden BAĞIMSIZ: her zaman "bu hafta"yı gösterir.
 * Gezinmeyle senkron tutmak ek karmaşıklık getirir, karşılığı yok (YAGNI).
 * Hata YUTULUR: kart "—" gösterir, mini takvim ve büyük takvim çalışmaya devam eder.
 */
async function renderWeekOverview() {
  const textEl = document.getElementById('week-overview-text');
  const barEl = document.getElementById('week-overview-bar');
  if (!textEl || !barEl) return;

  try {
    if (!currentUser) return;
    const { start, end } = weekRangeISO(localDayISO());

    const { data, error } = await sb
      .from('tasks')
      .select('completed')
      .eq('user_id', currentUser.id)
      .gte('day', start)
      .lte('day', end);

    if (error) throw error;

    const toplam = (data || []).length;
    const biten = (data || []).filter(t => t.completed).length;
    textEl.textContent = toplam ? `${biten}/${toplam} görev tamamlandı` : 'Bu hafta görev yok';
    barEl.style.width = toplam ? `${Math.round((biten / toplam) * 100)}%` : '0%';
  } catch (e) {
    console.warn('[Haftalık Özet] yüklenemedi:', e);
    textEl.textContent = '—';
    barEl.style.width = '0%';
  }
}
```

- [ ] **Step 3: `initCalendar` içinden çağır**

Task 3'te eklediğin `renderMiniCalendar();` satırının **hemen altına** ekle:

```js
    renderWeekOverview();   // await YOK: takvimin açılmasını bekletmez
```

- [ ] **Step 4: Tarayıcıda doğrula**

Sayfayı yenile → Takvim sekmesi.

Beklenen: "Bu Hafta" kartında `X/Y görev tamamlandı` yazıyor ve ilerleme çubuğu oranı gösteriyor. Bugün ekranında bir görevi tamamlayıp Takvim sekmesine dönünce sayı artmış olmalı.

Sayıyı doğrula — DevTools Console'da:

```js
(async () => {
  const { start, end } = weekRangeISO(localDayISO());
  const { data } = await sb.from('tasks').select('completed').eq('user_id', currentUser.id).gte('day', start).lte('day', end);
  console.log('aralık', start, '→', end, '| toplam', data.length, '| biten', data.filter(t => t.completed).length);
})()
```

Konsoldaki sayılar karttaki yazıyla aynı olmalı.

- [ ] **Step 5: Hata yolunu doğrula**

DevTools Console'da geçici olarak sorguyu bozup kartın çökmediğini gör:

```js
const _sb = sb.from; sb.from = () => { throw new Error('test'); };
await renderWeekOverview();
sb.from = _sb;
```

Beklenen: kart "—" gösteriyor, konsolda `[Haftalık Özet] yüklenemedi:` uyarısı var, **mini takvim ve büyük takvim etkilenmiyor**. Sonra sayfayı yenile.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Add weekly completion overview card to Takvim side panel"
```

---

### Task 5: Kart içeriği (`eventContent`), renk dili ve satır yüksekliği

**Files:**
- Modify: `index.html:122` ve `index.html:141-151` (FullCalendar CSS)
- Modify: `index.html` — `initCalendarUnsafe` içindeki `events:` kaynağı ve yeni `eventContent`

**Interfaces:**
- Consumes: mevcut `initCalendarUnsafe` event kaynağı
- Produces:
  - `YUK_RENK` — bilişsel yük → hex renk eşlemesi
  - `eventContent(arg)` callback'i

- [ ] **Step 1: Repo dizinine geç ve branch'i doğrula**

```bash
cd "C:/Users/dmrta/Desktop/Projeler/FocusAid/DehbProject/FocusAid"
git branch --show-current
```

Beklenen: `main`

- [ ] **Step 2: Renk eşlemesini ekle**

`initCalendarUnsafe` fonksiyonunun **hemen üstüne** ekle:

```js
// Kart renkleri bilişsel yüke bağlı — Bugün ekranındaki YUK_KENAR ile aynı
// anlam ekseni (yeşil=hafif, amber=orta, kırmızımsı=ağır). Renk dekoratif
// değil, bilgi taşıyor: DEHB kullanıcısı için gün planının ağırlığı bir
// bakışta görünmeli.
// NOT: veritabanında hem 'low/medium/high' hem eski 'Hafif/Orta/Ağır'
// değerleri bulunabiliyor, ikisi de eşlenmiş.
const YUK_RENK = {
  low: '#059669', medium: '#d97706', high: '#e11d48',
  Hafif: '#059669', Orta: '#d97706', Ağır: '#e11d48'
};
const RENK_TAMAMLANAN = '#64748b';
const RENK_GCAL = '#9333ea';
const RENK_MOLA = '#0d9488';
```

- [ ] **Step 3: Supabase event renklerini değiştir**

`initCalendarUnsafe` içinde şu satırları bul:

```js
                backgroundColor: task.completed ? '#e2e8f0' : '#ede9fe',
                textColor: task.completed ? '#64748b' : '#4338ca',
                borderColor: 'transparent'
```

Şununla değiştir:

```js
                backgroundColor: task.completed
                  ? RENK_TAMAMLANAN
                  : (YUK_RENK[task.cognitive_load] || YUK_RENK.medium),
                textColor: '#ffffff',
                borderColor: 'transparent'
```

- [ ] **Step 4: Google Calendar event renklerini değiştir**

Şu satırları bul:

```js
                backgroundColor: (ev.summary || '').includes('Mola') ? '#d1fae5' : '#f3e8ff',
                textColor: (ev.summary || '').includes('Mola') ? '#047857' : '#7c3aed',
                borderColor: 'transparent'
```

Şununla değiştir:

```js
                backgroundColor: (ev.summary || '').includes('Mola') ? RENK_MOLA : RENK_GCAL,
                textColor: '#ffffff',
                borderColor: 'transparent'
```

- [ ] **Step 5: `eventContent` callback'ini ekle**

`initCalendarUnsafe` içindeki `scrollTime: '08:00:00',` satırının **hemen altına** ekle:

```js
    // Kartın içeriğini süreye göre seçiyoruz. ÖNCEKİ SORUN: saat + başlık
    // her zaman birlikte basılıyordu; kısa görevlerde kutuya sığmayıp
    // overflow:hidden ikisini birden kırpıyor, kart boş renkli bir dikdörtgene
    // dönüyordu. 45 dakikanın altındaki kartlarda saat gizlenir, başlık kalır.
    eventContent(arg) {
      const baslik = arg.event.title || 'Görev';
      if (arg.view.type !== 'timeGridWeek') return true;   // ay görünümü FullCalendar'ın kendi render'ında kalsın

      const bas = arg.event.start, bit = arg.event.end;
      const dakika = (bas && bit) ? (bit - bas) / 60000 : 0;
      const kutu = document.createElement('div');
      kutu.className = 'fc-ozel-kart';

      if (dakika >= 45) {
        const saat = document.createElement('div');
        saat.className = 'fc-ozel-saat';
        saat.textContent = arg.timeText;
        kutu.appendChild(saat);
      }
      const ad = document.createElement('div');
      ad.className = 'fc-ozel-baslik';
      ad.textContent = baslik;
      kutu.appendChild(ad);

      return { domNodes: [kutu] };
    },
```

- [ ] **Step 6: CSS'i güncelle**

`index.html:141-151` arasındaki şu bloğu bul:

```css
.fc-timegrid-event{overflow:hidden!important}
```

satırından `.fc-timegrid-slot{height:2.3em!important}` satırına kadar olan **tüm bloğu** şununla değiştir:

```css
.fc-timegrid-event{overflow:hidden!important}
/* Kart içeriği artık eventContent ile kod tarafından üretiliyor (bkz.
   initCalendarUnsafe): saat yalnızca ≥45dk'lık kartlarda basılıyor, bu yüzden
   CSS'in saat etiketini gizlemesine/zorlamasına gerek kalmadı. */
.fc-ozel-kart{padding:1px 2px;min-width:0}
.fc-ozel-saat{font-size:.62rem;font-weight:700;opacity:.85;line-height:1.2}
.fc-ozel-baslik{font-size:.72rem;font-weight:700;line-height:1.2;overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}
/* Satır yüksekliği: 16 saat × 2.8em ≈ 717px. ~700px'lik kutuda (bkz. datesSet)
   başlık satırı düşülünce ~70-100px'lik hafif bir taşma kalıyor — kartların
   okunaklı kalması için kabul edilen bilinçli denge. Değiştirirsen Step 8'deki
   ölçümü tekrar çalıştır. */
.fc-timegrid-slot{height:2.8em!important}
```

- [ ] **Step 7: Tarayıcıda doğrula**

Sayfayı yenile → Takvim → `week` görünümü.

Doğrulanacaklar:
1. Kartlar dolu renkli (yeşil/turuncu/kırmızımsı), yazılar beyaz ve **okunuyor**.
2. 50 dakikalık görevlerde hem saat hem başlık var.
3. Kısa görevlerde (varsa) saat yok ama **başlık görünüyor** — boş kutu yok.
4. Ay görünümüne geç: kartlar eskisi gibi tek satır, bozulma yok.

- [ ] **Step 8: Taşma miktarını ölç**

Hafta görünümündeyken DevTools Console'da:

```js
const s = document.querySelector('.fc-timegrid-body').closest('.fc-scroller');
console.log('içerik', s.scrollHeight, '| görünür', s.clientHeight, '| taşma', s.scrollHeight - s.clientHeight);
```

Beklenen: taşma ~70–150px arası. **200px'i aşarsa** `.fc-timegrid-slot` yüksekliğini 2.6em'e düşür ve ölçümü tekrarla.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "Render week-view cards via eventContent; apply cognitive-load color language"
```

---

### Task 6: Form ve gün modalını temaya bağla, teşhis katmanını kaldır

**Files:**
- Modify: `index.html:322-341` (gün modalı), `index.html:346-383` (görev formu)
- Modify: `index.html:1102-1121` (geçici teşhis bloğu — silinecek)

**Interfaces:**
- Consumes: mevcut tema token'ları (`--glass-white`, `--border-light`, `--text-main`, `--text-soft`, `--card-hover-bg`, `--input-bg`)
- Produces: yok (son task)

- [ ] **Step 1: Repo dizinine geç ve branch'i doğrula**

```bash
cd "C:/Users/dmrta/Desktop/Projeler/FocusAid/DehbProject/FocusAid"
git branch --show-current
```

Beklenen: `main`

- [ ] **Step 2: Gün modalının sabit renklerini token'a çevir**

`index.html` içinde gün modalının kart sarmalayıcısını bul:

```html
    <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 animate-slide-in" onclick="event.stopPropagation()">
```

Şununla değiştir:

```html
    <div class="rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 animate-slide-in"
         style="background:var(--glass-white);border:1px solid var(--border-light)" onclick="event.stopPropagation()">
```

Aynı modal içindeki başlığı bul:

```html
          <h2 id="day-modal-date" class="text-3xl font-bold text-slate-900">-</h2>
```

Şununla değiştir:

```html
          <h2 id="day-modal-date" class="text-3xl font-bold" style="color:var(--text-main)">-</h2>
```

Modal alt butonlarını bul:

```html
        <button onclick="closeDayModal()" class="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all">Kapat</button>
```

Şununla değiştir:

```html
        <button onclick="closeDayModal()" class="flex-1 py-3 rounded-xl font-bold transition-all"
                style="background:var(--card-hover-bg);color:var(--text-main)">Kapat</button>
```

- [ ] **Step 3: Görev formunun sabit renklerini token'a çevir**

Form panelini bul:

```html
    <div id="task-form-panel" class="w-full xl:w-[480px] glass-card p-10 bg-white shadow-2xl border-l-4 border-indigo-500 hidden animate-slide-in">
```

Şununla değiştir (`bg-white` kaldırıldı — `glass-card` zaten temaya bağlı):

```html
    <div id="task-form-panel" class="w-full xl:w-[480px] glass-card p-10 shadow-2xl border-l-4 border-indigo-500 hidden animate-slide-in">
```

Form başlığını bul:

```html
        <h3 class="text-2xl font-bold text-slate-800">Görev Detayları</h3>
```

Şununla değiştir:

```html
        <h3 class="text-2xl font-bold" style="color:var(--text-main)">Görev Detayları</h3>
```

Form içindeki dört girdi alanının tamamını aşağıdaki gibi değiştir (her birinde `bg-slate-50` sınıfı siliniyor, yerine `style` ekleniyor).

`task-date` — bunu bul:

```html
            <input type="date" id="task-date" class="w-full bg-slate-50 p-4 rounded-2xl border border-transparent focus:border-indigo-200 outline-none font-medium">
```

şununla değiştir:

```html
            <input type="date" id="task-date" class="w-full p-4 rounded-2xl border border-transparent focus:border-indigo-200 outline-none font-medium"
                   style="background:var(--input-bg);color:var(--text-main)">
```

`task-start` — bunu bul:

```html
              <input type="time" id="task-start" onchange="updateEndTime()" class="w-full bg-slate-50 p-4 rounded-2xl border border-transparent focus:border-indigo-200 outline-none font-bold text-indigo-600">
```

şununla değiştir:

```html
              <input type="time" id="task-start" onchange="updateEndTime()" class="w-full p-4 rounded-2xl border border-transparent focus:border-indigo-200 outline-none font-bold text-indigo-600"
                     style="background:var(--input-bg)">
```

`task-end` — bunu bul:

```html
              <input type="time" id="task-end" class="w-full bg-slate-50 p-4 rounded-2xl border border-transparent focus:border-indigo-200 outline-none font-bold text-slate-400">
```

şununla değiştir:

```html
              <input type="time" id="task-end" class="w-full p-4 rounded-2xl border border-transparent focus:border-indigo-200 outline-none font-bold"
                     style="background:var(--input-bg);color:var(--text-soft)">
```

`task-desc` — bunu bul:

```html
            <textarea id="task-desc" placeholder="Notlarını veya n8n için ipuçlarını buraya yazabilirsin..." class="w-full bg-slate-50 p-5 rounded-3xl h-32 border border-transparent focus:border-indigo-200 outline-none resize-none text-sm leading-relaxed"></textarea>
```

şununla değiştir:

```html
            <textarea id="task-desc" placeholder="Notlarını veya n8n için ipuçlarını buraya yazabilirsin..." class="w-full p-5 rounded-3xl h-32 border border-transparent focus:border-indigo-200 outline-none resize-none text-sm leading-relaxed"
                      style="background:var(--input-bg);color:var(--text-main)"></textarea>
```

- [ ] **Step 4: Geçici teşhis bloğunu kaldır**

`index.html` içinde `// ── GEÇİCİ TEŞHİS:` yorumuyla başlayan bloğu bul ve **`window.addEventListener('error', ...)` bloğunun kapanış `});` satırına kadar tamamını sil**. Blok şu satırla başlar:

```js
// ── GEÇİCİ TEŞHİS: hafta görünümü "Uncaught (in promise)" hatasının kaynağını
```

ve şununla biter:

```js
window.addEventListener('error', (ev) => {
  console.error('[TEŞHİS] Yakalanmamış hata:', ev.error?.stack || ev.message, ev);
});
```

Silindikten sonra `<script>` etiketinin hemen ardından `// ── SUPABASE ───...` yorumu gelmeli.

- [ ] **Step 5: Koyu ve açık temada doğrula**

Sayfayı yenile → Takvim sekmesi.

1. Koyu tema açıkken bir güne tıkla → gün modalı **koyu**, yazılar okunuyor (beyaz kart değil).
2. Bir etkinliğe tıkla → görev formu koyu, tarih/saat/not alanları koyu zeminli ve yazılar okunuyor.
3. Sidebar'daki 🌗 anahtarla **açık temaya** geç → aynı iki panel açık temada da okunuyor.
4. DevTools Console'da `[TEŞHİS]` çıktısı **yok** ve sayfanın altında kırmızı kutu **yok**.

- [ ] **Step 6: Tüm testleri son kez çalıştır**

```bash
node --test
```

Beklenen: PASS — Task 1'de eklenen testler dahil hepsi geçiyor.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "Theme Takvim form and day modal via tokens; remove temporary diagnostics"
```

---

## Bitiş kontrolü

Tüm task'lar bitince tarayıcıda son bir tur:

- [ ] Takvim sayfası üç kolonlu: yan panel (mini takvim + özet + buton) ve büyük takvim
- [ ] Mini takvimde güne tıklayınca büyük takvim atlıyor; büyük takvim ay değiştirince mini takvim hizalanıyor
- [ ] "Bu Hafta" kartı gerçek sayıyı gösteriyor
- [ ] Hafta görünümündeki kartlar dolu renkli, başlıklar okunuyor, kısa görevlerde bile boş kutu yok
- [ ] Ay görünümü bozulmamış
- [ ] Koyu ve açık temanın ikisinde de modal ve form okunuyor
- [ ] `node --test` geçiyor
- [ ] Konsol temiz (`[TEŞHİS]`, `[Mini Takvim]`, `[Haftalık Özet]` uyarısı yok)

Kullanıcı onaylarsa: `git push origin main` ve Render Dashboard → `dehb-asistan` → **Manual Deploy → "Deploy latest commit"** (bu projede GitHub auto-deploy güvenilir değil).
