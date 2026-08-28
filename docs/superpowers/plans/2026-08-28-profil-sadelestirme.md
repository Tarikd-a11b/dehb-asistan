# Profil Sadeleştirme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profildeki karşılığı olmayan 6 alanı kaldır ve `todayMood`'u gerçekten günlük çalışır hale getir.

**Architecture:** Tazelik kararı saf ve test edilebilir bir fonksiyonda (`moodForToday`) durur; "bugün"ün hangi gün olduğuna `index.html` karar verir (Europe/Istanbul), böylece `profile-logic.js` saat dilimi bilmez. Alan kaldırma tek yönlü bir budama: arayüz → `profile-logic.js` → n8n sırasıyla, DB kolonlarına dokunulmadan.

**Tech Stack:** Vanilla JavaScript (build adımı yok), `node:test` + `node:assert`, Supabase Postgres (SQL Editor), n8n Code node'ları, Python 3 (JSON düzenleme).

**Spec:** `docs/superpowers/specs/2026-08-28-profil-sadelestirme-design.md`

## Global Constraints

- Testler kök dizinden **argümansız** çalışır: `node --test`. `node --test test/` Windows'ta `MODULE_NOT_FOUND` verir.
- Saf hesap `*-logic.js`'e girer; DOM, ağ ve saat dilimi `index.html` tarafında kalır.
- Kod yorumları ve kullanıcıya görünen metinler **Türkçe**.
- Dosyalar **LF** satır sonuyla yazılır (Python'da `newline=''`).
- **Hiçbir DB kolonu `DROP` edilmez.** Kaldırılan alanların kolonları durur; uygulama yazmayı/okumayı bırakır.
- n8n workflow JSON'u **toptan import edilmez**; yalnızca ilgili node'un `jsCode`'u elle taşınır. `Save task to Supabase` node'unda gerçek `service_role` anahtarı var.
- Geçici dosyalar repo dışına yazılır (`.gitignore` yalnızca `config.js` ve `*.pdf` içeriyor):
  ```bash
  SCRATCH=$(mktemp -d)
  ```
- Uygulama öncesi test tabanı: **93 test**.
- ⚠️ Bu plan `hyperfocusLimit`, `social`, `focusTrigger`, `motivationNote`, `superpowers` alanlarına **dokunmaz**. `energyPeak` de bu planın işi değil — o `2026-08-28-bilissel-yuke-gore-yerlestirme` planında.

---

### Task 1: DB kolonu ekle (ÖNKOŞUL — kod bundan önce deploy edilmez)

**Files:**
- Create: `fix-profiles-add-mood-date.sql`

**Interfaces:**
- Consumes: —
- Produces: `profiles.today_mood_date` (DATE) kolonu

⚠️ **Bu task'ın SQL adımı kullanıcı tarafından çalıştırılır.** Task 3 `profileToRow`'a
`today_mood_date` eklediği anda, kolon yoksa upsert `42703` ile patlar ve **profil kaydetme
tamamen kırılır**. Task 3'e geçmeden önce Step 3'teki doğrulama sorgusu bir satır dönmelidir.

- [ ] **Step 1: Migration dosyasını oluştur**

`fix-profiles-add-mood-date.sql`:

```sql
-- ═══════════════════════════════════════════════════════════
-- FocusAid — today_mood_date kolonu
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır.
--
-- NEDEN: `today_mood` "Bugün nasıl hissediyorsun" sorusunun cevabını
-- saklıyor ama TARİH DAMGASI YOKTU. Pazartesi "Beyin Sisi" seçildiyse değer
-- haftalarca kalıyor ve sonraki her planı sessizce küçültüyordu
-- (günlük seans -1). Kullanıcının bunu fark etmesi imkânsızdı.
--
-- NEDEN `updated_at` YETMİYOR: profilde HERHANGİ bir şey değişince
-- güncelleniyor. Salı günü mesai saatini değiştiren biri, pazartesiden
-- kalma modu "bugünkü" gibi göstermiş olurdu.
--
-- GÜVENLİ Mİ? Evet: yalnızca kolon ekleniyor, hiçbir şey düşürülmüyor veya
-- yeniden adlandırılmıyor. Mevcut satırlarda değer NULL kalır; uygulama
-- tarihi olmayan modu BAYAT sayar (moodForToday), yani eski satırlar
-- kendiliğinden doğru davranışa düşer.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS today_mood_date DATE;
```

- [ ] **Step 2: Kullanıcı SQL'i çalıştırsın**

Supabase Dashboard → SQL Editor → dosyanın içeriğini yapıştır → Run.

- [ ] **Step 3: Kolonun varlığını doğrula**

Supabase SQL Editor'de:

```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles' AND column_name='today_mood_date';
```

Expected: **bir satır** — `today_mood_date | date`. Satır dönmezse Task 3'e GEÇME.

- [ ] **Step 4: Commit**

```bash
git add fix-profiles-add-mood-date.sql
git commit -m "today_mood_date kolonu icin migration betigi ekle"
```

---

### Task 2: `moodForToday` — bayat modu ele

**Files:**
- Modify: `profile-logic.js`
- Test: `test/profile-logic.test.js`

**Interfaces:**
- Consumes: —
- Produces: `moodForToday(todayMood: string, todayMoodDate: string|null, bugun: string) => string`
  Tarihler `'YYYY-MM-DD'` biçiminde dizedir.

- [ ] **Step 1: Write the failing test**

`test/profile-logic.test.js` sonuna ekle:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `P.moodForToday is not a function`

- [ ] **Step 3: Write minimal implementation**

`profile-logic.js` içinde `profileCompleteness`'ten önce ekle:

```js
/**
 * Bugüne ait olmayan modu boş sayar.
 *
 * "Bugün nasıl hissediyorsun" sorusunun cevabı yalnızca o gün geçerlidir;
 * eskiden tarih damgası yoktu ve pazartesi seçilen mod haftalarca planı
 * küçültüyordu. Tarih karşılaştırması 'YYYY-MM-DD' dizeleri üzerinden yapılır;
 * hangi günün "bugün" olduğuna ÇAĞIRAN karar verir — bu dosya saat dilimi bilmez.
 *
 * ⚠️ Tarihi olmayan mod BAYAT sayılır. `today_mood_date` kolonu eklenmeden
 * önce kaydedilmiş satırların hepsi tarihsizdir; onları "bugünkü" saymak
 * düzeltmeye çalıştığımız hatayı sürdürürdü.
 */
function moodForToday(todayMood, todayMoodDate, bugun) {
  if (!todayMood || !todayMoodDate || !bugun) return '';
  return todayMoodDate === bugun ? todayMood : '';
}
```

Dışa aktarım listesine `moodForToday` ekle.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS — 98 test (93 + 5 yeni), 0 fail

- [ ] **Step 5: Commit**

```bash
git add profile-logic.js test/profile-logic.test.js
git commit -m "moodForToday ekle: tarihi bugun olmayan modu bayat say"
```

---

### Task 3: `today_mood_date`'i profil dönüşümüne bağla

**Files:**
- Modify: `profile-logic.js:13-19` (`DEFAULT_PROFILE`), `profile-logic.js:82` (`rowToProfile`), `profile-logic.js:116` (`profileToRow`)
- Test: `test/profile-logic.test.js`

**Interfaces:**
- Consumes: Task 1'in eklediği `profiles.today_mood_date` kolonu
- Produces: Profil nesnesinde `todayMoodDate` anahtarı; `profileToRow` çıktısında `today_mood_date`

⚠️ Task 1 Step 3'teki doğrulama sorgusu bir satır dönmeden bu task'a başlama.

- [ ] **Step 1: Write the failing test**

`test/profile-logic.test.js` sonuna ekle:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `todayMoodDate` `undefined`

- [ ] **Step 3: `DEFAULT_PROFILE`'a ekle**

`profile-logic.js` satır 15'i şu hale getir:

```js
  todayMood: '', todayMoodDate: '', hyperfocusLimit: 'none',
```

- [ ] **Step 4: `rowToProfile`'a ekle**

`profile-logic.js:82`'den sonraki satıra ekle:

```js
    todayMoodDate:    r.today_mood_date  ?? DEFAULT_PROFILE.todayMoodDate,
```

- [ ] **Step 5: `profileToRow`'a ekle**

`profile-logic.js:116`'dan sonraki satıra ekle:

```js
    today_mood_date:   p.todayMoodDate || null,
```

⚠️ Boş dize değil `null` yazılır: `DATE` kolonuna `''` göndermek Postgres'te
`invalid input syntax for type date` verir.

- [ ] **Step 6: `todayMood`'u doluluk hesabından çıkar**

`profileCompleteness`'teki `checks` dizisinden şu satırı sil:

```js
    p.todayMood !== '',
```

Gerekçe: `todayMood` artık günlük sıfırlanıyor. Hesapta kalsaydı profil doluluk çubuğu **her
sabah bir puan geri giderdi**; DEHB'li kullanıcı için geriye giden bir ilerleme çubuğu
demotive edicidir. Doluluk "profilini ne kadar tanıttın" sorusunun cevabıdır, günlük değişen
bir cevap oraya ait değil.

⚠️ `todayMoodDate` için doluluk kontrolü **EKLEME** — o da aynı sebeple hesaba girmemeli.

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 102 test (98 + 4 yeni), 0 fail

- [ ] **Step 8: Commit**

```bash
git add profile-logic.js test/profile-logic.test.js
git commit -m "todayMoodDate'i profil donusumune bagla, todayMood'u doluluk hesabindan cikar"
```

---

### Task 4: Arayüzde günlük modu uygula

**Files:**
- Modify: `index.html:2731-2736` (`setMood`), `index.html:2874` (profil yükleme)

**Interfaces:**
- Consumes: `moodForToday` (Task 2), `todayMoodDate` (Task 3)
- Produces: `bugunIstanbul()` yardımcı fonksiyonu

- [ ] **Step 1: "Bugün" yardımcısını ekle**

`index.html` içinde `setMood`'un hemen üstüne ekle:

```js
/* Europe/Istanbul yerel tarihi, 'YYYY-MM-DD'. Uygulamanin geri kalani da bu
   saat dilimini kullaniyor (n8n zamanlayicisindaki IST sabiti). `en-CA` yerel
   ayari tam olarak YYYY-MM-DD uretir. Saat dilimi bilgisi bilincli olarak
   burada durur; profile-logic.js saf kalsin. */
function bugunIstanbul() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}
```

- [ ] **Step 2: `setMood` tarihi de yazsın**

`index.html:2731-2736` şu hale gelsin:

```js
function setMood(mood, kullaniciTikladi = true) {
  userProfile.todayMood = mood;
  // Mod yalnizca secildigi gun gecerlidir; tarihi olmayan mod bayat sayilir
  // (bkz. moodForToday). Yukleme sirasinda (kullaniciTikladi=false) tarihe
  // DOKUNMA -- yoksa bayat bir mod her acilista bugune tasinirdi.
  if (kullaniciTikladi) {
    userProfile.todayMoodDate = bugunIstanbul();
    profiliKirlet();
  }
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mood-' + mood)?.classList.add('active');
}
```

⚠️ Bu, orijinaldeki `if (kullaniciTikladi) profiliKirlet();` satırının yerini alır — `profiliKirlet()`
çağrısı aynı koşulun içine taşındı, davranışı değişmedi.

- [ ] **Step 3: Yükleme bayat modu elesin**

`index.html:2874`'teki şu satırı:

```js
  if (userProfile.todayMood) setMood(userProfile.todayMood, false);
```

şununla değiştir:

```js
  // Bayat modu ele: dunden kalma "Beyin Sisi" bugunku plani kucultmemeli.
  const taze = moodForToday(userProfile.todayMood, userProfile.todayMoodDate, bugunIstanbul());
  userProfile.todayMood = taze;
  if (taze) setMood(taze, false);
  else document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
```

- [ ] **Step 4: Tarayıcıda doğrula**

```bash
python serve.py
```

`http://localhost:3000/auth.html` → giriş → Profil.

1. Bir mod seç, kaydet, sayfayı yenile → mod **seçili kalmalı**.
2. Tarayıcı konsolunda bayat mod taklidi yap:
   ```js
   userProfile.todayMoodDate = '2020-01-01';
   moodForToday(userProfile.todayMood, userProfile.todayMoodDate, bugunIstanbul());
   ```
   Expected: `''`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Profil: bayat modu ele, mod secilince tarih damgasi yaz"
```

---

### Task 5: `medication` kaldır

**Files:**
- Modify: `index.html:603` (kart alt metni), `index.html:605-611` (alan), `index.html:2738-2746` (`setMed`), `index.html:2873` (yükleme), `index.html:2827-2828` (yorum)
- Modify: `profile-logic.js` — `DEFAULT_PROFILE`, `rowToProfile`, `profileToRow`, `planningProfile`, `profileCompleteness`
- Test: `test/profile-logic.test.js`

**Interfaces:**
- Consumes: —
- Produces: `DEFAULT_PROFILE`, `planningProfile()` ve `profileToRow()` çıktılarında `medication` yok

- [ ] **Step 1: Write the failing test**

`test/profile-logic.test.js` sonuna ekle:

```js
// ── medication kaldirildi (2026-08-28) ──
test('DEFAULT_PROFILE medication tasimaz', () => {
  assert.ok(!('medication' in P.DEFAULT_PROFILE));
});

test('planningProfile ve profileToRow medication gondermez', () => {
  assert.ok(!('medication' in P.planningProfile({ medication: true })));
  assert.ok(!('medication' in P.profileToRow(P.DEFAULT_PROFILE, { id: 'u1', email: 'a@b.c' })));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `medication` hâlâ `DEFAULT_PROFILE`'da

- [ ] **Step 3: `profile-logic.js`'ten kaldır**

Dört yerden sil:

```js
  medication: false,                                              // DEFAULT_PROFILE (satir 12)
    medication:       r.medication       ?? DEFAULT_PROFILE.medication,   // rowToProfile
    medication:        !!p.medication,                            // profileToRow
    medication:       !!p.medication,                             // planningProfile
```

⚠️ `profileCompleteness`'te `medication` kontrolü **YOK** (kontrol edildi) — orada arama.

- [ ] **Step 4: Arayüzden kaldır**

`index.html:605-611` bloğunu sil:

```html
      <div class="space-y-3">
        <label class="block text-sm font-semibold text-slate-600">İlaç Kullanım Durumu</label>
        <div class="flex gap-2">
          <button id="med-yes" onclick="setMed(true)" class="flex-1 p-3 border-2 rounded-2xl text-xs font-bold transition-all">✅ Evet</button>
          <button id="med-no" onclick="setMed(false)" class="flex-1 p-3 border-2 rounded-2xl text-xs font-bold transition-all">❌ Hayır</button>
        </div>
      </div>
```

`index.html:2738-2746`'daki `setMed` fonksiyonunun tamamını sil.

`index.html:2873`'teki çağrıyı sil:

```js
  setMed(userProfile.medication, false);
```

- [ ] **Step 5: Kart alt metnini düzelt**

`index.html:603` artık yalnızca odak süresini anlatmalı:

```html
        <p class="text-[10px] text-slate-400 mt-1">Odak süren ve hiperfokus sınırın planlamayı şekillendirir</p>
```

- [ ] **Step 6: Kaydetme yorumunu güncelle**

`index.html:2827-2828`'deki yorumdan `medication` ve `setMed` çıkar:

```js
      // todayMood ve superpowers form alani degil; setMood/toggleSuperpowerUI
      // zaten userProfile'a yaziyor, merge onlari korur.
```

- [ ] **Step 7: Kalıntı taraması**

Run: `grep -n "medication\|setMed\|med-yes\|med-no" index.html profile-logic.js test/`
Expected: **Hiç sonuç yok.**

- [ ] **Step 8: Run tests**

Run: `node --test`
Expected: PASS — 104 test (102 + 2 yeni), 0 fail

- [ ] **Step 9: Commit**

```bash
git add index.html profile-logic.js test/profile-logic.test.js
git commit -m "medication alanini kaldir: toplanan ama hic kullanilmayan tibbi veri"
```

---

### Task 6: Duyusal Profil kartını kaldır

**Files:**
- Modify: `index.html:683-720` (kart), `index.html:2774-2780` (`seviyeEtiketiniGuncelle`), `index.html:2785-2790` (`isikHassasiyetiDegisti`), `index.html:2786`, `index.html:2821-2823`, `index.html:2868`, `index.html:2904-2905`
- Modify: `profile-logic.js` — `soundSensitivity`, `envPref`, `stimPref`
- Test: `test/profile-logic.test.js:50-58`

**Interfaces:**
- Consumes: —
- Produces: `soundSensitivity`, `envPref`, `stimPref` hiçbir yerde yok

> 🚨 **`lightSensitivity` ALANI KALIR.** Kartın içinde duruyor ama **koyu temanın hafızası**:
> `toggleTheme()` oraya yazıyor (`index.html:2900`), tema açılışta oradan okunuyor
> (`index.html:1635`, `2788`). **Kaydırıcı silinir, alan ve `themeIsDark` /
> `lightSensitivityForTheme` / `clampLevel` aynen durur.** Alan silinirse tema tercihi cihazlar
> arası kaybolur.

- [ ] **Step 1: Write the failing test**

`test/profile-logic.test.js` sonuna ekle:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `soundSensitivity hala var`

- [ ] **Step 3: `profile-logic.js`'ten üç alanı kaldır**

`DEFAULT_PROFILE`, `rowToProfile`, `profileToRow`, `planningProfile` içindeki
`soundSensitivity` / `envPref` / `stimPref` satırlarını sil.

`profileCompleteness`'teki `checks` dizisinden şu üç satırı sil:

```js
    clampLevel(p.soundSensitivity) !== DEFAULT_PROFILE.soundSensitivity,
    p.envPref !== DEFAULT_PROFILE.envPref,
    p.stimPref !== DEFAULT_PROFILE.stimPref,
```

🚨 **`clampLevel(p.lightSensitivity) !== DEFAULT_PROFILE.lightSensitivity` satırına DOKUNMA**,
ve `lightSensitivity`'nin diğer tüm satırlarını olduğu gibi bırak.

- [ ] **Step 4: Kartı sil**

`index.html:683-720` arasındaki bloğun tamamını sil (`<!-- 4. Duyusal Profil -->` yorumundan
kartın kapanış `</div>`'ine kadar).

- [ ] **Step 5: Ölen kodu sil**

| Yer | İşlem |
|---|---|
| `isikHassasiyetiDegisti()` (`index.html:2785-2790`) ve üstündeki yorum bloğu | Tamamını sil — tek çağıranı silinen kaydırıcının `oninput`'uydu |
| `seviyeEtiketiniGuncelle()` (`index.html:2774` civarı) | Tamamını sil — çağıranları `light-sensitivity`, `sound-sensitivity`, `rsd-level` kaydırıcılarıydı; üçü de gidiyor. ⚠️ Odak Süresi kaydırıcısı bu fonksiyonu KULLANMIYOR, kendi satır içi `oninput`'u var (`index.html:614`) |
| `index.html:2786` (`seviyeEtiketiniGuncelle('light-sensitivity');`) | Sil |
| `index.html:2868` (`['light-sensitivity','sound-sensitivity','rsd-level'].forEach(...)`) | Sil |
| `index.html:2904-2905` (`toggleTheme` içindeki kaydırıcı senkronu + üstündeki iki satırlık yorum) | Sil — kaydırıcı artık yok |
| `index.html:2900` (`mergeProfile(..., { lightSensitivity: ... })`) | **DOKUNMA** — temanın kalıcılığı buna bağlı |

- [ ] **Step 6: Kaydetme bloğundan çıkar**

`index.html:2821-2823` ve `2826`'daki **dört** satırı sil:

```js
      lightSensitivity: sayi('light-sensitivity'),
      soundSensitivity: sayi('sound-sensitivity'),
      envPref:          sg('env-pref'),
      stimPref:         sg('stim-pref')
```

⚠️ **Virgüle dikkat:** `stimPref` bloğun SON girdisi, sonunda virgül yok. Silince
`regulationMethod` son satır olur ve **onun sonundaki virgül kaldırılmalı** — yoksa sondaki
fazla virgül kalır. (Task 7 bu bloğun nihai halini veriyor, oraya bak.)

⚠️ `lightSensitivity` satırı da gidiyor **çünkü kaydırıcı yok** — ama alan `toggleTheme()`
üzerinden yazılmaya devam ediyor, `mergeProfile` onu koruyor.

- [ ] **Step 7: Yükleme bloğundan çıkar**

`ss('env-pref', ...)` ve `ss('stim-pref', ...)` çağrılarını sil.

- [ ] **Step 8: Mevcut testi güncelle**

`test/profile-logic.test.js:50-58`'deki `rowToProfile` testinden `sound_sensitivity`, `env_pref`,
`stim_pref` girdilerini ve karşılık gelen `assert` satırlarını çıkar.

- [ ] **Step 9: Kalıntı taraması**

Run: `grep -n "soundSensitivity\|sound-sensitivity\|envPref\|env-pref\|stimPref\|stim-pref\|seviyeEtiketiniGuncelle\|isikHassasiyetiDegisti" index.html profile-logic.js test/`
Expected: **Hiç sonuç yok.**

Run: `grep -c "lightSensitivity" profile-logic.js`
Expected: sıfırdan büyük — alan duruyor.

- [ ] **Step 10: Run tests**

Run: `node --test`
Expected: PASS — 106 test (104 + 2 yeni), 0 fail

- [ ] **Step 11: Tarayıcıda temayı doğrula**

`python serve.py` → giriş → kenar çubuğundaki ☀️/🌙 anahtarına bas → sayfayı yenile.
Expected: Tema seçimi **korunmalı**. Korunmuyorsa `lightSensitivity` yanlışlıkla silinmiştir.

- [ ] **Step 12: Commit**

```bash
git add index.html profile-logic.js test/profile-logic.test.js
git commit -m "Duyusal Profil kartini kaldir (lightSensitivity alani tema icin kaliyor)"
```

---

### Task 7: Duygu Regülasyonu kartını kaldır

**Files:**
- Modify: `index.html:721-746` (kart), `index.html:2824-2825` (kaydetme), yükleme bloğu
- Modify: `profile-logic.js` — `rsdLevel`, `regulationMethod`
- Test: `test/profile-logic.test.js`

**Interfaces:**
- Consumes: —
- Produces: `rsdLevel`, `regulationMethod` hiçbir yerde yok

`rsdLevel` şu an **çalışan** bir alan (n8n'de 4+ ise görev sayısı 1.5x). O davranış Task 8'de
temizleniyor; bu bilinçli bir sadeleştirme, davranış kaybediliyor.

- [ ] **Step 1: Write the failing test**

`test/profile-logic.test.js` sonuna ekle:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `rsdLevel` hâlâ `DEFAULT_PROFILE`'da

- [ ] **Step 3: `profile-logic.js`'ten kaldır**

`DEFAULT_PROFILE`, `rowToProfile`, `profileToRow`, `planningProfile` içindeki
`rsdLevel` / `regulationMethod` satırlarını sil.

`profileCompleteness`'teki `checks` dizisinden şu iki satırı sil:

```js
    clampLevel(p.rsdLevel) !== DEFAULT_PROFILE.rsdLevel,
    p.regulationMethod !== DEFAULT_PROFILE.regulationMethod,
```

- [ ] **Step 4: Kartı sil**

`index.html:721-746` arasındaki bloğun tamamını sil (`<!-- 5. Duygu Regülasyonu -->` yorumundan
kartın kapanış `</div>`'ine kadar).

- [ ] **Step 5: Kaydetme ve yükleme bloklarından çıkar**

`rsdLevel` ve `regulationMethod` satırlarını sil. Task 6 ile birlikte blok **tam olarak** şu hale
gelmeli — virgül hatası olmasın diye nihai hali veriyorum:

```js
    userProfile = mergeProfile(userProfile, {
      focusPeriod:      sayi('focus-period'),
      workHours:        { start: sg('work-start'), end: sg('work-end') },
      social:           sg('social-mode'),
      energyPeak:       energyEl ? energyEl.value : undefined,
      focusTrigger:     sg('focus-trigger'),
      motivationNote:   sg('motivation-note'),
      mainObstacle:     sg('main-obstacle'),
      breakStyle:       sg('break-style'),
      hyperfocusLimit:  sg('hyperfocus-limit')
      // todayMood ve superpowers form alani degil; setMood/toggleSuperpowerUI
      // zaten userProfile'a yaziyor, merge onlari korur.
    });
```

⚠️ `hyperfocusLimit` artık son girdi — **sonunda virgül YOK**.
⚠️ `energyPeak` satırı burada duruyor; onu kaldırmak
`2026-08-28-bilissel-yuke-gore-yerlestirme` planının işi, bu planın değil.

Yükleme bloğundaki `ss('regulation-method', ...)` çağrısını da sil.

- [ ] **Step 6: Mevcut testi güncelle**

`test/profile-logic.test.js`'teki `rowToProfile` testinden `rsd_level`, `regulation_method`
girdilerini ve karşılık gelen `assert` satırlarını çıkar.

- [ ] **Step 7: Kalıntı taraması**

Run: `grep -n "rsdLevel\|rsd-level\|rsd_level\|regulationMethod\|regulation-method\|regulation_method" index.html profile-logic.js test/`
Expected: **Hiç sonuç yok.**

- [ ] **Step 8: Run tests**

Run: `node --test`
Expected: PASS — 108 test (106 + 2 yeni), 0 fail

- [ ] **Step 9: Commit**

```bash
git add index.html profile-logic.js test/profile-logic.test.js
git commit -m "Duygu Regulasyonu kartini kaldir"
```

---

### Task 8: n8n `Normalize & Calculate` — kaldırılan alanları temizle, `anxious`'ı bağla

**Files:**
- Modify: `n8n-workflow-focusaid.json` → `Normalize & Calculate` node'unun `jsCode` alanı

**Interfaces:**
- Consumes: Task 5-7'nin sonucu (`planningProfile` artık bu alanları göndermiyor)
- Produces: `profile` çıktısında `medication`, `rsdLevel`, `soundSensitivity`, `envPref`, `regulationMethod`, `stimPref` yok

- [ ] **Step 1: Node kodunu dosyaya çıkar**

```bash
python -c "import json,io,os; d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8')); io.open(os.environ['SCRATCH']+'/nc.js','w',encoding='utf-8',newline='').write([n for n in d['nodes'] if n['name']=='Normalize & Calculate'][0]['parameters']['jsCode'])"
```

- [ ] **Step 2: Altı tanım satırını sil**

`$SCRATCH/nc.js` içinden:

```js
const medication = profile.medication ?? false;
const soundSensitivity = Number(profile.soundSensitivity) || 2;
const envPref = profile.envPref ?? 'minimal';
const regulationMethod = profile.regulationMethod ?? 'breathing';
const stimPref = profile.stimPref ?? 'fidget';
const rsdLevel = Number(profile.rsdLevel) || 2;
```

- [ ] **Step 3: `anxious`'ı kapasite düşürenlere ekle**

Şu satırı:

```js
if (todayMood === 'foggy' || todayMood === 'crash') perDayCap = Math.max(1, perDayCap - 1);
```

şununla değiştir:

```js
// Kaygi da yurutucu islevi dusurur; ayni yuku planlamak plani bastan cope atar.
if (todayMood === 'foggy' || todayMood === 'crash' || todayMood === 'anxious') perDayCap = Math.max(1, perDayCap - 1);
```

- [ ] **Step 4: `rsdCarpani`'yı temizle**

Şu satırları sil:

```js
// RSD yuksekse (4-5) is daha kucuk parcalara bolunur: buyuk bir gorevin yarim
// kalmasi elestiri/basarisizlik hissini tetikliyor.
const rsdCarpani = rsdLevel >= 4 ? 1.5 : 1;
```

`minTasks` / `maxTasks`'i çarpansız hallerine döndür:

```js
const minTasks = Math.max(3, Math.ceil(availableDays / 2));
const maxTasks = Math.max(minTasks + 1, availableDays * perDayCap);
```

- [ ] **Step 5: Çıktı nesnesini sadeleştir**

Dosyanın sonundaki `profile: { ... }` nesnesi şu hale gelsin:

```js
    profile: { focusPeriod, workHours, mainObstacle, breakStyle, breakMinutes,
               effectiveFocus, hyperfocusLimit, todayMood, focusTrigger,
               social, motivationNote, superpowers }
```

- [ ] **Step 6: Kodu JSON'a geri yaz**

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

- [ ] **Step 7: Doğrula**

```bash
python -c "
import json,io
d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8'))
c=[n for n in d['nodes'] if n['name']=='Normalize & Calculate'][0]['parameters']['jsCode']
for k in ['medication','rsdLevel','rsdCarpani','soundSensitivity','envPref','regulationMethod','stimPref']:
    assert k not in c, k+' hala var'
assert \"todayMood === 'anxious'\" in c, 'anxious baglanmamis'
print('temiz, anxious bagli')
"
```

Expected: `temiz, anxious bagli`

- [ ] **Step 8: Sözdizimi doğrula**

```bash
python -c "import json,io,os; d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8')); io.open(os.environ['SCRATCH']+'/syn.js','w',encoding='utf-8',newline='').write([n for n in d['nodes'] if n['name']=='Normalize & Calculate'][0]['parameters']['jsCode'])" && node --check $SCRATCH/syn.js && echo "sozdizimi gecerli"
```

Expected: `sozdizimi gecerli`

- [ ] **Step 9: Commit**

```bash
git add n8n-workflow-focusaid.json
git commit -m "Normalize & Calculate: kaldirilan profil alanlarini temizle, anxious'i bagla"
```

---

### Task 9: Canlı n8n'e taşı ve doğrula

**Files:**
- Modify: canlı n8n → `FocusAid Weekly Processor` (id `n5rKZDF9D1WRCHV9`) → `Normalize & Calculate`

**Interfaces:**
- Consumes: Task 8'in ürettiği JSON
- Produces: —

⚠️ **Workflow'u TOPTAN IMPORT ETME** (`Save task to Supabase`'de gerçek `service_role` anahtarı var).
⚠️ **Kodu tuş tuş yazdırma** — CodeMirror otomatik girinti yapıp bozar; panodan yapıştır.
⚠️ n8n `/` adresi `/assistant`'a yönlendiriyor; doğrudan `/workflow/n5rKZDF9D1WRCHV9` adresine git.

- [ ] **Step 1: Kodu panoya hazırla**

```bash
python -c "
import json,io
d=json.load(io.open('n8n-workflow-focusaid.json',encoding='utf-8'))
c=[n for n in d['nodes'] if n['name']=='Normalize & Calculate'][0]['parameters']['jsCode']
io.open('nc-panoya.js','w',encoding='utf-8',newline='').write(c)
print(len(c),'karakter')
"
```

PowerShell'de: `Get-Content -Raw -Encoding UTF8 nc-panoya.js | Set-Clipboard`

- [ ] **Step 2: Node'u güncelle**

1. `https://focusaid-n8n.duckdns.org/workflow/n5rKZDF9D1WRCHV9` (giriş gerekiyorsa kullanıcı yapar)
2. `Normalize & Calculate` node'una çift tıkla
3. Kod alanına tıkla → `Ctrl+A` → `Ctrl+V`
4. Paneli **X** ile kapat

- [ ] **Step 3: Yayınla ve doğrula**

Sağ üstteki turuncu **Publish**'e bas → yeşil **Published** olmalı.
Publish Timeline'ı aç (Publish yanındaki ok → View timeline) → en üstte bugünün tarihiyle yeni bir
`Published Version` ve yanında yeşil nokta.

- [ ] **Step 4: Geçici dosyayı sil**

```bash
rm -f nc-panoya.js
```

- [ ] **Step 5: Uçtan uca test (kullanıcı onayıyla)**

⚠️ Gerçek görev, gerçek takvim kaydı ve gerçek Gemini çağrısı üretir. Önce kullanıcıya sor.

1. Profilde `😰 Kaygılı` seç, kaydet.
2. Bir proje parçala → günlük seans sayısı normalden 1 az olmalı.
3. Profil ekranını yenile → mod hâlâ seçili (bugün seçildi).
4. `today_mood_date`'i Supabase'de elle dünün tarihine çek, sayfayı yenile → **hiçbir mod seçili
   olmamalı**.

- [ ] **Step 6: `CLAUDE.md`'yi güncelle**

Test sayısını **108** yap. (Kullanıcı "CLAUDE.md'yi güncelle" dediğinde yapılır — kendiliğinden değil.)

---

## Doğrulama Özeti

| Aşama | Komut | Beklenen |
|---|---|---|
| Task 1 | `information_schema.columns` sorgusu | bir satır: `today_mood_date | date` |
| Task 2 | `node --test` | 98 test, 0 fail |
| Task 3 | `node --test` | 102 test, 0 fail |
| Task 4 | tarayıcı: mod seç → yenile | mod korunuyor |
| Task 5 | `grep -n "medication\|setMed" index.html profile-logic.js test/` | sonuç yok · 104 test |
| Task 6 | duyusal alan grep'i + tema testi | sonuç yok · `lightSensitivity` duruyor · 106 test |
| Task 7 | rsd/regülasyon grep'i | sonuç yok · 108 test |
| Task 8 | doğrulama betiği + `node --check` | `temiz, anxious bagli` · sözdizimi geçerli |
| Task 9 | n8n Publish Timeline | bugünün tarihiyle yeni aktif sürüm |
