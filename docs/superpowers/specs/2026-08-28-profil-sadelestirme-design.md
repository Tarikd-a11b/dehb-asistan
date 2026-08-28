# Profil sadeleştirme — boşta duran alanları kaldır, `todayMood`'u günlük yap

**Tarih:** 2026-08-28
**Durum:** Tasarım onaylandı, uygulama bekliyor

## Sorun

Profil sayfası 18 alan topluyor. Kod okunarak çıkarıldı ki bunların **7'si** üretilen planı
veya arayüzü gerçekten değiştiriyor, **10'u** hiçbir işe yaramıyor:

| Çalışıyor | Ne yapıyor |
|---|---|
| `focusPeriod`, `workHours`, `breakStyle` | Seans uzunluğu, çalışma penceresi, mola dakikası |
| `todayMood` | Günlük seans sayısı ±1 |
| `rsdLevel` | 4+ ise görev sayısı 1.5x |
| `lightSensitivity` | Koyu tema |
| `mainObstacle` | AI prompt'unda geçiyor |

| Dekor | Durum |
|---|---|
| `medication`, `social`, `focusTrigger`, `soundSensitivity`, `envPref`, `stimPref`, `regulationMethod`, `motivationNote`, `superpowers` | n8n'e gidiyor, profil nesnesinde duruyor, hiçbir kod okumuyor |
| `hyperfocusLimit` | Menü "60 dk'da bir **uyar**" diyor ama **uygulamada alarm yok** |

Bir DEHB uygulaması için bu kötü bir oran. Profili doldurmak zaten kullanıcıya maliyetli bir iş;
karşılığında hiçbir şey değişmiyorsa uygulamaya olan güveni zedeler.

Ayrıca `todayMood`'da gerçek bir hata var:

**"Bugün nasıl hissediyorsun" bugünlük değil.** `today_mood` profile kaydediliyor ama **tarih
damgası ve günlük sıfırlama yok**. Pazartesi `🌫️ Beyin Sisi`'ne basıldıysa değer haftalarca orada
kalır ve **sonraki her planı sessizce küçültür** (günlük seans −1). Kullanıcının bunu fark etmesi
imkânsız; profili açıp bakmadıkça.

Ve beş mood butonundan biri ölü: **`😰 Kaygılı` hiçbir şey yapmıyor** — n8n yalnızca
`foggy`/`crash`/`hyper`/`focused` değerlerini tanıyor.

## Hedef

Profildeki her sorunun bir karşılığı olsun. Karşılığı olmayanlar kalksın, `todayMood` gerçekten
günlük çalışsın.

Profil **18 alandan 11'e** iner.

## Kapsam dışı

- **`energyPeak` kaldırma.** Zaten `2026-08-28-bilissel-yuke-gore-yerlestirme-design.md`
  kapsamında; iki spec'te birden yapılmaz.
- **Hiperfokus alarmını inşa etmek.** `hyperfocusLimit` alanı ve menüsü **olduğu gibi kalır**;
  gerçek alarm kendi spec'inde yapılacak. Bu spec o alana dokunmaz.
- **`social` ve `focusTrigger` kaldırmak.** Kullanıcı bunlara ileride işlev tanımlamak istiyor;
  şimdilik dururlar.
- **`motivationNote` ve `superpowers`.** Dekor oldukları doğru ama kullanıcı bu turda kaldırma
  kararı vermedi.
- **DB kolonu düşürmek.** Kaldırılan hiçbir alanın kolonu `DROP` edilmez — geri dönüşsüz ve
  kazancı yok. Kolonlar durur, uygulama yazmayı/okumayı bırakır.

## Tasarım

### 1. `todayMood` günlük olsun

**Yeni kolon gerekiyor.** `profiles.updated_at` bu iş için kullanılamaz: profilde *herhangi* bir
şey değiştiğinde güncelleniyor, dolayısıyla pazartesi girilen modu salı günü "taze" gösterir.

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS today_mood_date DATE;
```

Betik `fix-profiles-add-mood-date.sql` adıyla repoya eklenir (mevcut `fix-*.sql` kalıbı).

**Tazelik kararı saf bir fonksiyonda:**

```js
/**
 * Bugüne ait olmayan modu boş sayar. Tarih karşılaştırması 'YYYY-MM-DD'
 * dizeleri üzerinden yapılır; hangi günün "bugün" olduğuna çağıran karar
 * verir (bu dosya saat dilimi bilmez).
 */
function moodForToday(todayMood, todayMoodDate, bugun)
```

- Mod boşsa → `''`
- **Tarih yoksa → `''`** (bayat say). Kolon eklenmeden önce kaydedilmiş satırların hepsi
  tarihsizdir; bunları "bugünkü" saymak tam da düzeltmeye çalıştığımız hatayı sürdürür.
- Tarih bugüne eşitse → mod, değilse → `''`

`rowToProfile` bu fonksiyonu **çağırmaz** (saf kalsın, saat dilimi bilmesin); `index.html`
profili yükledikten sonra uygular. "Bugün" **Europe/Istanbul** yerel tarihidir — uygulamanın geri
kalanı da bu saat dilimini kullanıyor (n8n zamanlayıcısındaki `IST = 3*3600*1000`).

**Yazma tarafı:** `setMood()` moda basıldığında `todayMoodDate`'i de bugüne ayarlar;
`profileToRow` `today_mood_date` kolonunu yazar.

**Temizlik işi yok.** Bayat mod DB'de durur, okurken görmezden gelinir; bir sonraki kayıt üzerine
yazar. Arka plan görevi veya cron gerekmez.

### 2. `😰 Kaygılı` kapasiteyi azaltsın

n8n `Normalize & Calculate` içinde:

```js
if (todayMood === 'foggy' || todayMood === 'crash' || todayMood === 'anxious') perDayCap = Math.max(1, perDayCap - 1);
```

Gerekçe: kaygı yürütücü işlevi düşürür; aynı yükü planlamak planı baştan çöpe atar.

### 3. `medication` kaldırma

| Dosya | Ne yapılacak |
|---|---|
| `index.html` | "İlaç Kullanım Durumu" alanı + `setMed()` + kaydet/yükle satırları; karttaki "İlaç ve odak süren planlamayı şekillendirir" alt metni de düzeltilmeli (artık yalnızca odak süresi) |
| `profile-logic.js` | `DEFAULT_PROFILE`, `rowToProfile`, `profileToRow`, `planningProfile`, `profileCompleteness` |
| `n8n-workflow-focusaid.json` | `Normalize & Calculate` tanımı + çıktı nesnesi |
| `schema.sql` | **Dokunulmuyor** — `medication` kolonu kalır |

Gerekçe: evet/hayır bilgisi planlama için zaten yetersiz — işe yarayacak olan ilacın *ne zaman*
alındığı ve etki süresi olurdu. Bu haliyle sağlık verisi toplanıp hiç kullanılmıyor; iki dünyanın
da kötüsü.

### 4. Duyusal Profil kartı kaldırma

Kart tamamen kalkar. Giden alanlar: `soundSensitivity`, `envPref`, `stimPref`.

> ⚠️ **`lightSensitivity` ALANI KALIR.** Bu alan Duyusal Profil kartının bir parçası gibi görünse
> de aslında **koyu temanın hafızasıdır**: kenar çubuğundaki ☀️/🌙 anahtarı `toggleTheme()` ile
> buraya yazıyor (`index.html:2900`), tema açılışta buradan okunuyor (`index.html:1635`, `2788`).
> **Karttaki kaydırıcı silinir, alan ve `themeIsDark`/`lightSensitivityForTheme` fonksiyonları
> aynen durur.** Alan silinirse tema tercihi cihazlar arası kaybolur — `localStorage.focusaid_theme`
> yedeği yalnızca o tarayıcıda geçerlidir.

**Kartla birlikte ölen kod — bırakılmamalı:**

| Yer | Ne olacak |
|---|---|
| `isikHassasiyetiDegisti()` (`index.html:2785`) | Yalnızca ışık kaydırıcısının `oninput`'u çağırıyordu → **sil** |
| `seviyeEtiketiniGuncelle()` (`index.html:2774`) | Çağıranları `light-sensitivity`, `sound-sensitivity`, `rsd-level` kaydırıcılarıydı; üçü de gidiyor → **sil**. ⚠️ Odak Süresi kaydırıcısı bu fonksiyonu kullanmıyor, kendi satır içi `oninput`'u var (`index.html:614`), o yüzden fonksiyon gerçekten çağrısız kalıyor. |
| `index.html:2786` ve `2868` | Bu fonksiyona yapılan çağrılar → **sil** |
| `toggleTheme()` içindeki kaydırıcı senkronu (`index.html:2904-2905`) | Kaydırıcı artık yok; `if (kaydirici)` koruması sayesinde patlamaz ama ölü kod → **sil** |
| `toggleTheme()` içindeki `mergeProfile(..., { lightSensitivity: ... })` (`index.html:2900`) | **KALIR.** Temanın kalıcılığı buna bağlı. |
| `themeIsDark`, `lightSensitivityForTheme`, `clampLevel` (`profile-logic.js`) | **KALIR.** Tema bunları kullanıyor. |

### 5. Duygu Regülasyonu kartı kaldırma

Kart tamamen kalkar. Giden alanlar: `rsdLevel`, `regulationMethod`.

`rsdLevel` şu an **çalışan** bir alan (4+ ise görev sayısı 1.5x, yani işler daha küçük parçalara
bölünüyor). Kaldırılması bilinçli bir sadeleştirme; bu davranış kaybediliyor. n8n tarafında
temizlenecekler:

```js
const rsdLevel = Number(profile.rsdLevel) || 2;      // sil
const rsdCarpani = rsdLevel >= 4 ? 1.5 : 1;          // sil
const minTasks = Math.max(3, Math.ceil(availableDays / 2 * rsdCarpani));   // carpansiz
const maxTasks = Math.max(minTasks + 1, Math.ceil(availableDays * perDayCap * rsdCarpani));
```

`minTasks`/`maxTasks` çarpansız hallerine döner:

```js
const minTasks = Math.max(3, Math.ceil(availableDays / 2));
const maxTasks = Math.max(minTasks + 1, availableDays * perDayCap);
```

### 6. Sonuç

| Kalan (11) | Giden (7) |
|---|---|
| `focusPeriod`, `workHours`, `breakStyle`, `todayMood` (+`todayMoodDate`), `lightSensitivity`, `mainObstacle`, `hyperfocusLimit`, `social`, `focusTrigger`, `motivationNote`, `superpowers` | `medication`, `soundSensitivity`, `envPref`, `stimPref`, `rsdLevel`, `regulationMethod`, (`energyPeak` — öbür spec) |

## Test

`test/profile-logic.test.js`:

- `moodForToday`:
  - Bugünün tarihiyle → mod aynen döner
  - Dünün tarihiyle → `''`
  - **Tarih `null`/`undefined`/`''` → `''`** (kolon eklenmeden önceki satırlar bayat sayılır)
  - Mod `''` iken tarih bugün olsa bile → `''`
- `DEFAULT_PROFILE` kaldırılan altı anahtarı taşımaz.
- `planningProfile` kaldırılan altı alanı göndermez.
- `profileToRow` kaldırılan kolonları yazmaz, `today_mood_date`'i yazar.
- `rowToProfile` ↔ `profileToRow` gidiş-dönüşü hâlâ korunur (mevcut test güncellenir).
- `profileCompleteness` hâlâ 0 döner / doldurdukça artar (payda küçülüyor, testler oransal
  olduğu için geçmeli).

## Riskler ve uygulama sırası

**⚠️ SQL önce, kod sonra.** `profileToRow` `today_mood_date` kolonunu yazmaya başladığı anda,
kolon yoksa upsert `42703` ile patlar ve **profil kaydetme tamamen kırılır**. Bu tam olarak
`fix-profiles-schema-align.sql` başlığında anlatılan hatanın aynısı. Sıra:

1. `fix-profiles-add-mood-date.sql`'i Supabase SQL Editor'de çalıştır
2. Kolonun varlığını doğrula:
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='today_mood_date';
   ```
   Bir satır dönmeli.
3. Ancak ondan sonra kod değişikliklerini deploy et

**Okuma tarafı zaten güvenli:** `moodForToday` tarih yokken `''` döndüğü için, kolon eklenmeden
önce kaydedilmiş satırlar sorun çıkarmaz.

**Diğer spec'le çakışma:** `2026-08-28-bilissel-yuke-gore-yerlestirme` de `profile-logic.js` ve
`Normalize & Calculate` node'una dokunuyor. İkisi aynı satırlara girmiyor (o spec `energyPeak` ve
görev sıralaması, bu spec mood/medication/duyusal/regülasyon), ama **ikisi de aynı n8n node'unu
elle canlıya taşıtıyor.** Sıralı yapılmalı; ikisi birden yarım kalmış haldeyken canlıya taşıma
yapılmamalı.
