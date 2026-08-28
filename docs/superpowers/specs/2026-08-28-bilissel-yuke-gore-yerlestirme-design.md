# Görevleri bilişsel yüke göre gün içinde yerleştirme

**Tarih:** 2026-08-28
**Durum:** Tasarım onaylandı, uygulama bekliyor

## Sorun

Profil 18 alan topluyor ama bunların yalnızca 6'sı üretilen planı gerçekten değiştiriyor
(`focusPeriod`, `workHours`, `breakStyle`, `todayMood`, `rsdLevel`, ve yalnız arayüz temasını
etkileyen `lightSensitivity`). Geri kalanı ya prompt'a metin olarak giriyor ya da hiç
kullanılmıyor.

İki somut kayıp var:

1. **`cognitiveLoad` üretiliyor ama yerleştirmede kullanılmıyor.** AI Agent her görev için
   `low`/`medium`/`high` üretiyor, `Code in JavaScript` bunu göreve yazıyor ve Supabase'e
   kaydediyor — ama görevin *ne zaman* yapılacağına hiç etki etmiyor. Görevler bağımlılık
   sırasına göre boş saatlere diziliyor, zorluğuna kör. Zor bir görev günün son seansına,
   rutin bir görev ilk seansına düşebiliyor.

2. **`hyperfocusLimit` hesaplanıp çöpe atılıyor.** 2026-08-28'de `Normalize & Calculate`
   node'una `effectiveFocus` eklendi (`hyperfocusLimit` seçiliyse seans süresini kırpar), ama
   `Code in JavaScript` hâlâ ham `profile.focusPeriod` okuyor. Yani "beni 90 dakikadan fazla
   oturtma" ayarı şu an hiçbir şeyi değiştirmiyor.

## Hedef

Bir günün en zor görevi, o günün en erken seansına düşsün. Kullanıcı çalışma penceresini
(`workHours`) kendi iyi saatlerine göre çizdiği için — gece çalışan biri 20:00–04:00 yazar,
zamanlayıcı gece aşan pencereyi zaten doğru işliyor — "günün ilk seansı" pratikte "odağın
yüksek olduğu ilk saat" demektir.

Ayrıca `hyperfocusLimit` ilk kez gerçekten seans süresini sınırlasın.

## Kapsam dışı

- **Görevlerin hangi güne düştüğü.** `targetIdx` (orantılı gün dağıtımı) formülü aynı kalıyor;
  tek istisna `T === 1` çökme koruması (bkz. §5), o da yalnızca bugün patlayan bir durumu
  karşılıyor. Sadece gün *içindeki* sıra değişiyor.
- **Taşma mantığı, takvim çakışması kontrolü, `maxPerDay`, mutlak-dakika ekseni.** Hiçbirine
  dokunulmuyor.
- **Zamanlayıcının tamamını `*-logic.js`'e taşımak.** Yalnızca yeni sıralama mantığı ayrı
  dosyaya çıkıyor; mevcut yerleştirme kodu n8n node'unda kalıyor.
- **`schema.sql`'deki `energy_peak` kolonunu düşürmek.** Kolon silmek geri dönüşsüz ve bir
  kazancı yok; kayıtlı veri duruyor, yalnızca yazılıp okunması bırakılıyor.
- **Boşta duran diğer 8 alan** (`medication`, `social`, `focusTrigger`, `motivationNote`,
  `soundSensitivity`, `envPref`, `regulationMethod`, `stimPref`, `superpowers`). Ayrı iş.

## Mevcut yerleştirme mekaniği

`Code in JavaScript` içinde:

- `sessions[]` — **gün başına bir kayıt**; her biri o günün tüm çalışma penceresi
  (`{ key, start, end }`, mutlak dakika).
- `maxPerDay = ceil(T / A)` — T görev sayısı, A gün sayısı.
- Ana döngü `i = 0..T-1` sırayla ilerler. Her görev için hedef gün:
  `targetIdx = A > 1 ? Math.round(i * (A - 1) / (T - 1)) : 0`
- `findSlot(session)` seansın başından itibaren `step` adımlarıyla ilerleyip **ilk boş** aralığı
  döndürür. Gün doluysa (`count >= maxPerDay`) `null` döner ve döngü önce sonraki, sonra önceki
  günlere bakar.

Kritik davranış: **önce işlenen görev, o günün en erken boş saatini alır.** Dolayısıyla gün
içindeki yerleşimi değiştirmek için *işlenme sırasını* değiştirmek yeterli; yerleştirici
koduna dokunmak gerekmiyor.

## Tasarım

### 1. Yeni dosya: `scheduling-logic.js`

Saf, DOM'suz, ağsız. CLAUDE.md'deki "saf hesap `*-logic.js`'e" kuralına uyar.

```js
const LOAD_RANK = { high: 0, medium: 1, low: 2 };

/** Görev indeksini hedef güne çevirir. T === 1 iken 0/0 = NaN üretmez. */
function targetDayIndex(i, taskCount, dayCount)

/**
 * Görev indekslerini, gün içinde bilişsel yüke göre sıralanmış işlenme
 * sırasına çevirir. Günler arası sıra korunur.
 * Dönüş: [{ index, targetIdx }, ...]
 */
function orderTasksByLoad(tasks, dayCount)
```

`orderTasksByLoad` davranışı:

1. Her görev için `targetDayIndex` hesaplanır, görevler hedef güne göre gruplanır.
2. Her grup kendi içinde `LOAD_RANK`'e göre artan sıralanır (`high` önce).
3. **Eşit yükte orijinal indeks sırası korunur** — kararlı sıralama. Aynı zorluktaki işler
   bağımlılık sırasını asla kaybetmez.
4. Gruplar `targetIdx` artan sırayla birleştirilir.

Tanınmayan/eksik `cognitiveLoad` değeri `medium` sayılır (mevcut kodun varsayılanıyla aynı).

### 2. `Code in JavaScript` node'unda değişiklik

- Ana döngü `i = 0..T-1` yerine `orderTasksByLoad(...)` çıktısı üzerinde yürür; `targetIdx`
  önceden hesaplanmış olandan gelir.
- `const focusPeriod = profile.focusPeriod || 25;` →
  `const focusPeriod = profile.effectiveFocus || profile.focusPeriod || 25;`
- `results` dizisi **hedef sıraya göre** dolar. Çıktı sırası değiştiği için `title` üretimindeki
  `'Gorev ' + (i + 1)` yedeği artık orijinal görev indeksini kullanmalı, işlenme sırasını değil.

⚠️ **Çıktı sırası kırılgan bir bağın parçası.** `Prepare Supabase Payload`, takvim olaylarını
görevlerle **indeks eşleşmesiyle** birleştiriyor:

```js
const events = $input.all();
const tasks  = $('Code in JavaScript').all();
return events.map((item, i) => { const task = (tasks[i] || tasks[0]).json; ... });
```

Bu eşleşme, `Create an event` node'unun girdi sırasını koruyup her öğe için bir çıktı üretmesine
dayanıyor. Sıralama değişikliği bu bağı **bozmuyor** — takvim olayları da yeni sıradaki aynı
öğelerden üretiliyor, yani `events[i]` ile `tasks[i]` hâlâ aynı görevi gösteriyor. Ama bu bağ
belgelenmemişti; ileride `Code in JavaScript` çıktısını filtreleyen/yeniden sıralayan biri
görevleri yanlış takvim etkinliğine bağlayabilir. Uygulama sırasında bu satırların üstüne
açıklama notu eklenmeli.

`scheduling-logic.js`'teki iki fonksiyonun gövdesi node'un başına birebir kopyalanır. n8n Code
node'u yerel dosya `require` edemiyor; repo JSON'u zaten canlı node'un aynası, bu ikilik
hâlihazırda var (bkz. CLAUDE.md — workflow'u toptan import etme uyarısı).

### 3. `Normalize & Calculate` node'unda değişiklik

`slotsPerDay` hesabı ham `focusPeriod` kullanıyor; `effectiveFocus` kullanmalı. Aksi halde
hiperfokus sınırı koyan kullanıcıda günlük kapasite olduğundan az hesaplanır.

### 4. `energyPeak` kaldırma

| Dosya | Ne yapılacak |
|---|---|
| `index.html` | Profildeki radio grubu (3 seçenek) + kaydet/yükle satırları |
| `profile-logic.js` | `DEFAULT_PROFILE`, `rowToProfile`, `profileToRow`, `mergeProfile`, `planningProfile` |
| `n8n-workflow-focusaid.json` | `Normalize & Calculate` tanımı + çıktısı, AI Agent prompt'undaki "enerji zirvesi" |
| `test/profile-logic.test.js` | İlgili beklentiler |
| `schema.sql` | **Dokunulmuyor** — kolon kalıyor |

Gerekçe: `workHours` aynı bilgiyi daha kesin taşıyor. Alan yalnızca birinin mesaisi kendi iyi
penceresinden geniş olduğunda ek bilgi verirdi; buna karşılık profilde cevaplanması gereken
her soru DEHB'li kullanıcı için bir maliyet.

⚠️ `energyPeak` şu an AI Agent prompt'unda geçiyor, yani tamamen ölü değil — kaldırma prompt'u
bir miktar daha az kişiselleştirir. Bilinçli kabul edilen bedel.

### 5. `T === 1` hatası

`Math.round(i * (A - 1) / (T - 1))` ifadesi `T === 1` ve `A > 1` iken `0/0 = NaN` üretir;
`sessions[NaN]` → `undefined` → `findSlot` patlar. Prompt en az 3 görev istiyor ama AI'nın 1
görev döndürmesini engelleyen bir şey yok. `targetDayIndex` bu durumu `0` döndürerek karşılar.

## Test

`test/scheduling-logic.test.js`:

- `targetDayIndex`: T=1/A>1 → 0 (regresyon); tek gün → hep 0; uçlar 0 ve A-1.
- `orderTasksByLoad`:
  - Gün içinde `high` görev `low`'dan önce gelir.
  - Eşit yükte orijinal sıra korunur (kararlılık).
  - Görevlerin **gün dağılımı değişmez** — sıralama öncesi ve sonrası her `targetIdx`'e düşen
    görev *sayısı* aynı.
  - Eksik/tanınmayan `cognitiveLoad` → `medium` muamelesi.
  - Tek görev, tek gün, boş liste.

`test/profile-logic.test.js`: `energyPeak` beklentileri kaldırılır.

Zamanlayıcının geri kalanı (`findSlot`, taşma, çakışma) bu turda test kapsamına alınmıyor —
kapsam dışı.

## Riskler

- **Gün içi takas taşmayı etkileyebilir.** Bir gün dolduğunda hangi görevin komşu güne
  kaydığı işlenme sırasına bağlı; sıra değişince kayan görev de değişebilir. Güne düşen görev
  *sayısı* değişmediği için plan bütünlüğü bozulmaz, ama tek tek görevlerin günü kayabilir.
  Test bunu `targetIdx` başına sayı korunumuyla yakalıyor.
- **n8n node'u ile repo JSON'u ayrışabilir.** Yamayı canlıya taşıma adımı elle; atlanırsa repo
  doğru, canlı eski kalır. Uygulama sonunda canlıya taşındığı doğrulanmalı.
