# Bilişsel Yüke Göre Yerleştirme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bir günün en zor görevi o günün en erken seansına düşsün.

**Architecture:** Görevlerin hangi güne düştüğü değişmez; yalnızca gün içindeki *işlenme sırası* `cognitiveLoad`'a göre yeniden düzenlenir. Yerleştirici zaten "önce işlenen, o günün en erken boş saatini alır" mantığıyla çalıştığı için sıralamayı değiştirmek yerleşimi değiştirmeye yeter — `findSlot`, taşma ve çakışma koduna hiç dokunulmaz. Yeni sıralama mantığı test edilebilir olsun diye saf bir `scheduling-logic.js` dosyasına çıkar, gövdesi n8n Code node'una kopyalanır.

**Tech Stack:** Vanilla JavaScript (build adımı yok), `node:test` + `node:assert`, n8n Code node'ları (JSON içinde dize olarak saklanan JS), Python 3 (JSON düzenleme betikleri için).

**Spec:** `docs/superpowers/specs/2026-08-28-bilissel-yuke-gore-yerlestirme-design.md`

## Global Constraints

- Testler kök dizinden **argümansız** çalışır: `node --test`. `node --test test/` Windows'ta `MODULE_NOT_FOUND` verir — kullanma.
- Saf hesap `*-logic.js` dosyalarına girer; DOM ve `fetch` `*-view.js` / `index.html` tarafında kalır.
- `*-logic.js` dosyaları DOM'suz ve ağsız olmalı; dışa aktarım `if (typeof module !== 'undefined' && module.exports)` kalıbıyla yapılır (tarayıcıda `module` tanımsız).
- Kod yorumları ve kullanıcıya görünen metinler **Türkçe**.
- Dosyalar **LF** satır sonuyla yazılır (Python'da `newline=''`, mevcut içerik korunur).
- n8n workflow JSON'u **toptan import edilmez**; yalnızca ilgili node'un `jsCode`'u elle taşınır. `Save task to Supabase` node'unda gerçek `service_role` anahtarı var.
- `schema.sql`'deki `energy_peak` kolonuna **dokunulmaz**.
- Her task sonunda `node --test` tamamen yeşil olmalı (uygulama öncesi taban: **93 test**).
- **Geçici dosyalar asla repo içine yazılmaz.** `.gitignore` yalnızca `config.js` ve `*.pdf`
  içeriyor; repo köküne bırakılan bir `.js` yanlışlıkla commit'lenir. Task 5-7'deki betikler
  repo dışında bir scratch dizini kullanır:

  ```bash
  SCRATCH=$(mktemp -d)   # her kabuk oturumunda bir kez
  echo "$SCRATCH"
  ```

---

### Task 1: `targetDayIndex` — gün ataması + `T === 1` çökme düzeltmesi

**Files:**
- Create: `scheduling-logic.js`
- Test: `test/scheduling-logic.test.js`

**Interfaces:**
- Consumes: —
- Produces: `targetDayIndex(i: number, taskCount: number, dayCount: number) => number`

Mevcut n8n kodundaki satır şu:

```js
const targetIdx = A > 1 ? Math.round(i * (A - 1) / (T - 1)) : 0;
```

`T === 1` ve `A > 1` iken `0 * (A-1) / 0` → `NaN`; `sessions[NaN]` → `undefined` → `findSlot` patlar. Bu task o formülü, davranışı koruyarak ama çökmeden, saf bir fonksiyona taşır.

- [ ] **Step 1: Write the failing test**

`test/scheduling-logic.test.js` dosyasını oluştur:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module '../scheduling-logic.js'`

- [ ] **Step 3: Write minimal implementation**

`scheduling-logic.js` dosyasını oluştur:

```js
/* ══════════════════════════════════════════════════════════════
   FocusAid — Görev sıralama saf mantık katmanı
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   Testler: node --test   (kök dizinden, ARGÜMANSIZ)

   ⚠️ Bu dosyadaki fonksiyonların gövdesi n8n'deki `FocusAid Weekly
   Processor` → `Code in JavaScript` node'una BİREBİR kopyalanır. n8n Code
   node'u yerel dosya `require` edemez. Burayı değiştirirsen node'u da
   güncelle, yoksa repo ile canlı ayrışır.
   ══════════════════════════════════════════════════════════════ */

/**
 * Görev indeksini hedef güne çevirir: görevler mevcut günlere orantılı
 * dağıtılır (ilk görev ilk güne, son görev son güne).
 * ⚠️ `taskCount === 1` iken eski satır `0/0 = NaN` üretiyordu ve
 * `sessions[NaN]` çökmeye yol açıyordu; tek görev her zaman ilk güne gider.
 */
function targetDayIndex(i, taskCount, dayCount) {
  if (dayCount <= 1 || taskCount <= 1) return 0;
  return Math.round(i * (dayCount - 1) / (taskCount - 1));
}
```

Dosyanın sonuna dışa aktarımı ekle:

```js
// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { targetDayIndex };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS — 98 test (93 mevcut + 5 yeni), 0 fail

- [ ] **Step 5: Commit**

```bash
git add scheduling-logic.js test/scheduling-logic.test.js
git commit -m "targetDayIndex'i saf fonksiyona cikar, T=1 iken NaN cokmesini duzelt"
```

---

### Task 2: `orderTasksByLoad` — gün içi bilişsel yük sıralaması

**Files:**
- Modify: `scheduling-logic.js`
- Test: `test/scheduling-logic.test.js`

**Interfaces:**
- Consumes: `targetDayIndex(i, taskCount, dayCount)` (Task 1)
- Produces: `orderTasksByLoad(tasks: Array<{cognitiveLoad?: string, cognitive_load?: string}>, dayCount: number) => Array<{index: number, targetIdx: number}>`
  ve `LOAD_RANK: {high: 0, medium: 1, low: 2}`

Dönüş dizisi **işlenme sırasıdır**: `index` orijinal görev indeksi, `targetIdx` o görevin hedef günü.

- [ ] **Step 1: Write the failing test**

`test/scheduling-logic.test.js` dosyasının sonuna ekle:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `S.orderTasksByLoad is not a function`

- [ ] **Step 3: Write minimal implementation**

`scheduling-logic.js` içinde `targetDayIndex`'ten sonra, dışa aktarımdan önce ekle:

```js
/** Bilişsel yük sırası: küçük sayı = önce yapılsın. */
const LOAD_RANK = { high: 0, medium: 1, low: 2 };

/**
 * Görevin yük sırasını verir. Alan eksikse veya tanınmayan bir değerse
 * `medium` sayılır — yerleştiricinin varsayılanıyla aynı.
 */
function loadRank(task) {
  const raw = task && (task.cognitiveLoad || task.cognitive_load);
  const r = LOAD_RANK[raw];
  return r === undefined ? LOAD_RANK.medium : r;
}

/**
 * Görevleri, gün içinde bilişsel yüke göre sıralanmış İŞLENME SIRASINA
 * çevirir. Yerleştirici "önce işlenen, o günün en erken boş saatini alır"
 * mantığıyla çalıştığı için bu, zor görevi günün ilk seansına oturtur.
 *
 * Günler arası sıra KORUNUR: bir görev asla başka bir güne taşınmaz, yalnızca
 * kendi günündeki arkadaşlarıyla yer değiştirir. Eşit yükte orijinal indeks
 * sırası korunur (`a - b` eşitlik bozucusu), böylece aynı zorluktaki işler
 * yapay zekânın verdiği bağımlılık sırasını kaybetmez.
 */
function orderTasksByLoad(tasks, dayCount) {
  const list = Array.isArray(tasks) ? tasks : [];
  const T = list.length;

  const groups = new Map();
  for (let i = 0; i < T; i++) {
    const targetIdx = targetDayIndex(i, T, dayCount);
    if (!groups.has(targetIdx)) groups.set(targetIdx, []);
    groups.get(targetIdx).push(i);
  }

  const out = [];
  for (const targetIdx of [...groups.keys()].sort((a, b) => a - b)) {
    const idxs = groups.get(targetIdx);
    idxs.sort((a, b) => {
      const d = loadRank(list[a]) - loadRank(list[b]);
      return d !== 0 ? d : a - b;
    });
    for (const index of idxs) out.push({ index, targetIdx });
  }
  return out;
}
```

Dışa aktarım satırını güncelle:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LOAD_RANK, targetDayIndex, loadRank, orderTasksByLoad };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS — 107 test (98 + 9 yeni), 0 fail

- [ ] **Step 5: Commit**

```bash
git add scheduling-logic.js test/scheduling-logic.test.js
git commit -m "orderTasksByLoad ekle: gun icinde zor gorev one alinir, esit yukte sira korunur"
```

---

### Task 3: `energyPeak`'i `profile-logic.js`'ten kaldır

**Files:**
- Modify: `profile-logic.js:13`, `profile-logic.js:77`, `profile-logic.js:109`, `profile-logic.js:186`, `profile-logic.js:229`
- Test: `test/profile-logic.test.js:57`, `test/profile-logic.test.js:95`

**Interfaces:**
- Consumes: —
- Produces: `DEFAULT_PROFILE` artık `energyPeak` anahtarını içermez; `planningProfile()` çıktısında `energyPeak` yoktur.

⚠️ `schema.sql`'deki `energy_peak` kolonu **kalır**. `profileToRow` artık o kolonu yazmaz, `rowToProfile` okumaz; mevcut satırlardaki değer olduğu gibi durur.

- [ ] **Step 1: Testleri güncelle (önce testler kırılsın)**

`test/profile-logic.test.js:57` satırını sil:

```js
  assert.strictEqual(p.energyPeak, 'night');
```

`test/profile-logic.test.js:95` satırındaki `energyPeak: 'night', ` kısmını çıkar; satır şu hale gelsin:

```js
    focusPeriod: 45, rsdLevel: 5,
```

`test/profile-logic.test.js:51` satırındaki `energy_peak: 'night', ` kısmını çıkar; satır şu hale gelsin:

```js
    sound_sensitivity: 5, env_pref: 'nature',
```

- [ ] **Step 2: Yeni davranışı sabitleyen test ekle**

`test/profile-logic.test.js` sonuna ekle:

```js
// ── energyPeak kaldirildi (2026-08-28) ──
test('DEFAULT_PROFILE energyPeak tasimaz', () => {
  assert.ok(!('energyPeak' in P.DEFAULT_PROFILE));
});

test('planningProfile energyPeak gondermez', () => {
  const p = P.planningProfile({ energyPeak: 'night' });
  assert.ok(!('energyPeak' in p));
});

test('profileToRow energy_peak kolonunu yazmaz', () => {
  const row = P.profileToRow(P.DEFAULT_PROFILE, { id: 'u1', email: 'a@b.c' });
  assert.ok(!('energy_peak' in row));
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — 3 yeni test kırmızı (`energyPeak` hâlâ `DEFAULT_PROFILE`'da)

- [ ] **Step 4: `profile-logic.js`'ten kaldır**

Satır 13 — `energyPeak: 'morning', ` kısmını çıkar:

```js
  social: 'solo', focusTrigger: 'silence',
```

Satır 77 — bu satırı tamamen sil:

```js
    energyPeak:       r.energy_peak      ?? DEFAULT_PROFILE.energyPeak,
```

Satır 109 — bu satırı tamamen sil:

```js
    energy_peak:       p.energyPeak,
```

Satır 186 — bu satırı tamamen sil:

```js
    energyPeak:       p.energyPeak,
```

Satır 229 — `profileCompleteness` içindeki bu satırı sil (doluluk paydası 1 azalır; testler oransal olduğu için etkilenmez):

```js
    p.energyPeak !== DEFAULT_PROFILE.energyPeak,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 110 test (107 + 3 yeni), 0 fail

- [ ] **Step 6: Commit**

```bash
git add profile-logic.js test/profile-logic.test.js
git commit -m "energyPeak'i profil mantigindan kaldir (workHours ayni bilgiyi tasiyor)"
```

---

### Task 4: `energyPeak`'i arayüzden kaldır

**Files:**
- Modify: `index.html:638-645`, `index.html:2806`, `index.html:2815`, `index.html:2870-2871`

**Interfaces:**
- Consumes: `DEFAULT_PROFILE` artık `energyPeak` içermiyor (Task 3)
- Produces: —

⚠️ `index.html` içindeki `Enerji Düşük` (satır 593, mood butonu) ve `Çaba (Enerji Devamlılığı)` (satır 969, bilgi metni) **başka şeylerdir**, dokunma.

- [ ] **Step 1: Radio grubunu sil**

`index.html` satır 638-645 arasındaki bloğun tamamını sil:

```html
      <div class="space-y-3">
        <label class="block text-sm font-semibold text-slate-600">En Yüksek Enerji Zamanın</label>
        <div class="space-y-2">
          <label class="energy-radio-option"><input type="radio" name="energy-peak" value="morning" checked class="accent-emerald-600"><span>🌅 Sabah (Early Bird)</span></label>
          <label class="energy-radio-option"><input type="radio" name="energy-peak" value="afternoon" class="accent-emerald-600"><span>☀️ Öğleden Sonra</span></label>
          <label class="energy-radio-option"><input type="radio" name="energy-peak" value="night" class="accent-emerald-600"><span>🌙 Gece (Night Owl)</span></label>
        </div>
      </div>
```

- [ ] **Step 2: Kaydetme kodundan çıkar**

Satır 2806'yı sil:

```js
    const energyEl = document.querySelector('input[name="energy-peak"]:checked');
```

Satır 2815'i sil:

```js
      energyPeak:       energyEl ? energyEl.value : undefined,
```

- [ ] **Step 3: Yükleme kodundan çıkar**

Satır 2870-2871'i sil:

```js
  const radio = document.querySelector(`input[name="energy-peak"][value="${userProfile.energyPeak}"]`);
  if (radio) radio.checked = true;
```

- [ ] **Step 4: Artık kullanılmayan CSS sınıfını sil**

Step 1'de o sınıfı kullanan tek HTML bloğu gitti. `index.html:234-235`'teki iki tanımı da sil:

```css
.energy-radio-option{display:flex;align-items:center;gap:.75rem;padding:.65rem 1rem;background:var(--card-hover-bg);color:var(--text-main);border-radius:.75rem;cursor:pointer;transition:all .2s ease;font-size:.875rem;font-weight:500}
.energy-radio-option:hover{filter:brightness(1.08);transform:translateX(4px)}
```

Run: `grep -c "energy-radio-option" index.html`
Expected: `0`

- [ ] **Step 5: Kalıntı taraması**

Run: `grep -rn "energyPeak\|energy-peak" index.html profile-logic.js test/`
Expected: **Hiç sonuç yok.**

- [ ] **Step 6: Testler hâlâ yeşil mi**

Run: `node --test`
Expected: PASS — 110 test, 0 fail

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "Profil ekranindan enerji zirvesi alanini kaldir"
```

---

### Task 5: n8n `Normalize & Calculate` — `energyPeak`'i çıkar

**Files:**
- Modify: `n8n-workflow-focusaid.json` → `Normalize & Calculate` node'unun `jsCode` alanı

**Interfaces:**
- Consumes: —
- Produces: `Code in JavaScript` node'una giden `profile` nesnesi `energyPeak` içermez.

⚠️ **`effectiveFocus`'a DOKUNMA.** Bu planın ilk halinde `effectiveFocus` kapasite hesabına bağlanacaktı; 2026-08-28'de kapsam dışına alındı, çünkü `hyperfocusLimit` seans kısaltan bir ayar değil gerçek bir alarm olacak (ayrı spec). Hesaplandığı yerde kalsın, kullanılmasın.

- [ ] **Step 1: Node kodunu dosyaya çıkar**

```bash
python -c "import json,io,os; d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8')); io.open(os.environ['SCRATCH']+'/nc.js','w',encoding='utf-8',newline='').write([n for n in d['nodes'] if n['name']=='Normalize & Calculate'][0]['parameters']['jsCode'])"
```

- [ ] **Step 2: `energyPeak` tanımını sil**

`$SCRATCH/nc.js` içinden bu satırı sil:

```js
const energyPeak = profile.energyPeak ?? 'morning';
```

- [ ] **Step 3: Çıktıdan `energyPeak`'i sil**

Dosyanın sonundaki `profile: { ... }` nesnesinden `energyPeak, ` kısmını çıkar. Sonuç:

```js
    profile: { focusPeriod, workHours, mainObstacle, breakStyle, breakMinutes,
               effectiveFocus, medication, hyperfocusLimit, todayMood, focusTrigger,
               social, motivationNote, rsdLevel, soundSensitivity, envPref,
               regulationMethod, stimPref, superpowers }
```

- [ ] **Step 4: Kodu JSON'a geri yaz**

```bash
python -c "
import json,io,os
p='n8n-workflow-focusaid.json'
d=json.load(io.open(p,encoding='utf-8'))
code=io.open(os.environ['SCRATCH']+'/nc.js',encoding='utf-8').read()
[n for n in d['nodes'] if n['name']=='Normalize & Calculate'][0]['parameters']['jsCode']=code
io.open(p,'w',encoding='utf-8',newline='').write(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
"
```

- [ ] **Step 5: JSON geçerliliğini ve içeriği doğrula**

```bash
python -c "
import json,io,os
d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8'))
c=[n for n in d['nodes'] if n['name']=='Normalize & Calculate'][0]['parameters']['jsCode']
assert 'energyPeak' not in c, 'energyPeak hala var'
assert 'effectiveFocus + breakMinutes' not in c, 'effectiveFocus kapasite hesabina baglanmis (kapsam disi)'
print('JSON gecerli, energyPeak temiz')
"
```

Expected: `JSON gecerli, energyPeak temiz`

- [ ] **Step 6: AI Agent prompt'undan `energyPeak`'i çıkar**

```bash
python -c "
import json,io,os
p='n8n-workflow-focusaid.json'
d=json.load(io.open(p,encoding='utf-8'))
n=[x for x in d['nodes'] if x['name']=='AI Agent'][0]
t=n['parameters']['text']
eski='enerji zirvesi {{ \$json.profile.energyPeak }}, '
assert eski in t, 'prompt kalibi bulunamadi, elle bak'
n['parameters']['text']=t.replace(eski,'')
io.open(p,'w',encoding='utf-8',newline='').write(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('prompt guncellendi')
"
```

- [ ] **Step 7: Repoda `energyPeak` kalmadığını doğrula**

Run: `grep -c "energyPeak" n8n-workflow-focusaid.json`
Expected: `0`

- [ ] **Step 8: Commit**

```bash
git add n8n-workflow-focusaid.json
git commit -m "Normalize & Calculate: energyPeak'i cikar"
```

---

### Task 6: n8n `Code in JavaScript` — gün içi sıralamayı bağla

**Files:**
- Modify: `n8n-workflow-focusaid.json` → `Code in JavaScript` node'unun `jsCode` alanı

**Interfaces:**
- Consumes: `targetDayIndex`, `loadRank`, `orderTasksByLoad`, `LOAD_RANK` (Task 1-2, gövdeleri kopyalanır)
- Produces: Çıktı öğeleri aynı şekle sahip (`title`, `summary`, `cognitiveLoad`, `day`, `start`, `end`, ...), yalnızca **dizi sırası** değişir.

- [ ] **Step 1: Node kodunu dosyaya çıkar**

```bash
python -c "import json,io,os; d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8')); io.open(os.environ['SCRATCH']+'/cj.js','w',encoding='utf-8',newline='').write([n for n in d['nodes'] if n['name']=='Code in JavaScript'][0]['parameters']['jsCode'])"
```

- [ ] **Step 2: Sıralama fonksiyonlarını dosyanın başına ekle**

`$SCRATCH/cj.js` içinde, ilk yorum bloğundan hemen sonra, `const merged = ...` satırının üstüne ekle:

```js
// ── scheduling-logic.js'ten kopyalandi (n8n Code node'u yerel dosya require edemez) ──
// Burada bir sey degistirirsen scheduling-logic.js'i ve testlerini de guncelle.
const LOAD_RANK = { high: 0, medium: 1, low: 2 };

function targetDayIndex(i, taskCount, dayCount) {
  if (dayCount <= 1 || taskCount <= 1) return 0;
  return Math.round(i * (dayCount - 1) / (taskCount - 1));
}

function loadRank(task) {
  const raw = task && (task.cognitiveLoad || task.cognitive_load);
  const r = LOAD_RANK[raw];
  return r === undefined ? LOAD_RANK.medium : r;
}

function orderTasksByLoad(tasks, dayCount) {
  const list = Array.isArray(tasks) ? tasks : [];
  const T = list.length;
  const groups = new Map();
  for (let i = 0; i < T; i++) {
    const targetIdx = targetDayIndex(i, T, dayCount);
    if (!groups.has(targetIdx)) groups.set(targetIdx, []);
    groups.get(targetIdx).push(i);
  }
  const out = [];
  for (const targetIdx of [...groups.keys()].sort((a, b) => a - b)) {
    const idxs = groups.get(targetIdx);
    idxs.sort((a, b) => {
      const d = loadRank(list[a]) - loadRank(list[b]);
      return d !== 0 ? d : a - b;
    });
    for (const index of idxs) out.push({ index, targetIdx });
  }
  return out;
}
// ── kopya sonu ──
```

- [ ] **Step 3: Ana döngüyü yeni sırayla çalıştır**

Şu blok:

```js
const results = [];
for (let i = 0; i < T; i++) {
  const t = rawTasks[i] || {};
  const targetIdx = A > 1 ? Math.round(i * (A - 1) / (T - 1)) : 0;
```

şununla değiştir:

```js
// Gorevler gun ICINDE bilissel yuke gore siralanir: yerlestirici "once islenen,
// o gunun en erken bos saatini alir" mantigiyla calistigi icin zor gorev gunun
// ilk seansina oturur. Gunler arasi sira degismez.
const results = [];
for (const { index: i, targetIdx } of orderTasksByLoad(rawTasks, A)) {
  const t = rawTasks[i] || {};
```

⚠️ `i` hâlâ **orijinal görev indeksi** olduğu için aşağıdaki `'Gorev ' + (i + 1)` yedek başlığı doğru kalır — değiştirme.

- [ ] **Step 4: Kırılgan indeks bağını belgele**

`$SCRATCH/cj.js` dosyasının en sonundaki `return results;` satırının üstüne ekle:

```js
// ⚠️ Bu dizinin SIRASI onemli: `Prepare Supabase Payload` node'u takvim
// olaylarini gorevlerle indeks esleşmesiyle birlestiriyor (`tasks[i]`).
// Cikti sirasini filtreleyen/degistiren bir sey eklersen orada da duzelt,
// yoksa gorevler yanlis takvim etkinligine baglanir.
```

- [ ] **Step 5: Kodu JSON'a geri yaz**

```bash
python -c "
import json,io,os
p='n8n-workflow-focusaid.json'
d=json.load(io.open(p,encoding='utf-8'))
code=io.open(os.environ['SCRATCH']+'/cj.js',encoding='utf-8').read()
[n for n in d['nodes'] if n['name']=='Code in JavaScript'][0]['parameters']['jsCode']=code
io.open(p,'w',encoding='utf-8',newline='').write(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
"
```

- [ ] **Step 6: Kopyalanan gövdenin `scheduling-logic.js` ile aynı olduğunu doğrula**

```bash
python -c "
import json,io,re
d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8'))
node=[n for n in d['nodes'] if n['name']=='Code in JavaScript'][0]['parameters']['jsCode']
src=io.open('scheduling-logic.js',encoding='utf-8').read()
def govde(s,ad):
    m=re.search(r'function '+ad+r'\([^)]*\) \{.*?\n\}', s, re.S)
    assert m, ad+' bulunamadi'
    return re.sub(r'\s+',' ',m.group(0))
for ad in ['targetDayIndex','loadRank','orderTasksByLoad']:
    assert govde(node,ad)==govde(src,ad), ad+' ayristi'
print('uc fonksiyon da birebir ayni')
"
```

Expected: `uc fonksiyon da birebir ayni`

- [ ] **Step 7: Node kodunu sözdizimi açısından çalıştırılabilir doğrula**

```bash
python -c "import json,io,os; d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8')); io.open(os.environ['SCRATCH']+'/syn.js','w',encoding='utf-8',newline='').write([n for n in d['nodes'] if n['name']=='Code in JavaScript'][0]['parameters']['jsCode'])" && node --check $SCRATCH/syn.js && echo "sozdizimi gecerli"
```

Expected: `sozdizimi gecerli`

(`node --check` yalnızca ayrıştırma yapar; `$` ve `$json` gibi n8n'e özel global'ler çalıştırılmadığı için sorun çıkarmaz.)

- [ ] **Step 8: Testler hâlâ yeşil mi**

Run: `node --test`
Expected: PASS — 110 test, 0 fail

- [ ] **Step 9: Commit**

```bash
git add n8n-workflow-focusaid.json
git commit -m "Code in JavaScript: gun ici bilissel yuk siralamasini bagla"
```

---

### Task 7: Canlı n8n'e taşı ve doğrula

**Files:**
- Modify: canlı n8n → `FocusAid Weekly Processor` (id `n5rKZDF9D1WRCHV9`) → `Normalize & Calculate` ve `Code in JavaScript` node'ları

**Interfaces:**
- Consumes: Task 5 ve 6'nın ürettiği `n8n-workflow-focusaid.json`
- Produces: —

⚠️ **Workflow'u TOPTAN IMPORT ETME.** `Save task to Supabase` node'unda gerçek `service_role` anahtarı var ve canlı akış repodan sapmış olabilir. Yalnızca iki node'un kodu elle taşınır.

⚠️ **Kodu tuş tuş yazdırma** — n8n'in CodeMirror editörü otomatik girinti/parantez kapatması yapıp bozar. Panodan yapıştır.

- [ ] **Step 1: İki node'un kodunu panoya hazırla**

```bash
python -c "
import json,io,os
d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8'))
for ad,dosya in [('Normalize & Calculate','nc.js'),('Code in JavaScript','cj.js')]:
    c=[n for n in d['nodes'] if n['name']==ad][0]['parameters']['jsCode']
    io.open(dosya,'w',encoding='utf-8',newline='').write(c)
    print(ad,'->',dosya,len(c),'karakter')
"
```

- [ ] **Step 2: `Normalize & Calculate` node'unu güncelle**

1. `https://focusaid-n8n.duckdns.org/workflow/n5rKZDF9D1WRCHV9` adresini aç (giriş gerekiyorsa kullanıcı yapar).
2. `Normalize & Calculate` node'una çift tıkla.
3. PowerShell'de: `Get-Content -Raw -Encoding UTF8 nc.js | Set-Clipboard`
4. Kod alanına tıkla → `Ctrl+A` → `Ctrl+V`.
5. Paneli **X** ile kapat.

- [ ] **Step 3: `Code in JavaScript` node'unu güncelle**

1. `Code in JavaScript` node'una çift tıkla.
2. PowerShell'de: `Get-Content -Raw -Encoding UTF8 cj.js | Set-Clipboard`
3. Kod alanına tıkla → `Ctrl+A` → `Ctrl+V`.
4. Paneli **X** ile kapat.

- [ ] **Step 4: Yayınla**

Sağ üstteki turuncu **Publish**'e bas. Buton yeşil **Published**'a dönmeli.

- [ ] **Step 5: Yayınlandığını doğrula**

Publish Timeline'ı aç (Publish yanındaki ok → View timeline). En üstte bugünün tarihiyle yeni bir `Published Version` satırı ve yanında yeşil nokta olmalı.

- [ ] **Step 6: Geçici dosyaları sil**

```bash
rm -f nc.js cj.js
```

- [ ] **Step 7: Uçtan uca test (kullanıcı onayıyla)**

⚠️ Bu adım **gerçek görev, gerçek takvim kaydı ve gerçek Gemini çağrısı** üretir. Çalıştırmadan önce kullanıcıya sor.

Uygulamada, bilişsel yükü karışık olacak kadar geniş bir proje parçala (ör. 5+ günlük teknik bir proje). Sonra Görevlerim ekranında kontrol et:

- Aynı güne düşen görevlerden **en zor olanı o günün en erken saatinde** mi?
- Görev sayısı ve günlere dağılım makul mü (bir güne yığılma yok)?

- [ ] **Step 8: Commit yok**

Bu task repo dosyası değiştirmez; commit gerekmez.

---

## Doğrulama Özeti

| Aşama | Komut | Beklenen |
|---|---|---|
| Task 1 sonu | `node --test` | 98 test, 0 fail |
| Task 2 sonu | `node --test` | 107 test, 0 fail |
| Task 3 sonu | `node --test` | 110 test, 0 fail |
| Task 4 sonu | `grep -rn "energyPeak\|energy-peak" index.html profile-logic.js test/` | sonuç yok |
| Task 5 sonu | `grep -c "energyPeak" n8n-workflow-focusaid.json` | `0` |
| Task 6 sonu | `node --check` + fonksiyon karşılaştırma betiği | sözdizimi geçerli, gövdeler aynı |
| Task 7 sonu | n8n Publish Timeline | bugünün tarihiyle yeni aktif sürüm |

**Son adım:** `CLAUDE.md`'deki test sayısını 93 → 110 güncelle ve `scheduling-logic.js`'i test edilen dosyalar listesine ekle.
