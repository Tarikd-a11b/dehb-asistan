# Modun görev sayısına etkisi

**Tarih:** 2026-08-30
**Durum:** Uygulandı, yerelde ölçüldü — canlı n8n'e uygulanması bekliyor

## Sorun

2026-08-29'da `todayMood` AI prompt'una bağlandı ve ölçüldü: talimatın **"adımları küçült"**
yarısı çalışıyor, **"görev sayısını azalt"** yarısı çalışmıyor. AI görev sayısını projenin
kapsamına göre seçiyor, verilen `minTasks`–`maxTasks` aralığını umursamıyor (aynı proje,
`anxious` 9 görev, `hyper` 9 görev).

Kök sebep aralığın kendisi değil: **`perDayCap` yerleştirmeye hiç ulaşmıyordu.**
`Code in JavaScript` günlük tavanı `maxPerDay = ceil(T / A)` ile kendi hesaplıyor; moddan
haberi yok. Mod yalnızca AI'ya verilen bir tavsiyeydi ve tavsiye tutulmuyordu.

## Karar 1 — mod görev SİLMEZ

Tavanı sertleştirip fazla görevi atmak akla ilk gelen çözümdü; reddedildi. Görev düşürmek
projeyi yarım planlar ve teslim tarihi sessizce kaçar. Kullanıcı "bugün kaygılıyım" dediğinde
istediği şey işin yok olması değil, **bugünün hafiflemesi.**

Bu yüzden taşan görev sonraki günlere yayılır. Toplam görev sayısı korunur; test bunu bir
değişmez olarak tutuyor (`kapasite >= T`).

## Karar 2 — mod yalnızca BUGÜNÜ değiştirir

`todayMood` günlük bir alan: `today_mood_date` bugünün İstanbul tarihi değilse bayat sayılıp
düşüyor. Bugünkü kaygıyı 5. günün kapasitesine uygulamak alanın anlamına aykırı.

## Karar 3 — tavan `ceil(T/A)`'ya göre değil, günün DOĞAL sayısına göre kaydırılır

İlk uygulama `todayCap = ceil(T/A) + moodDelta` idi ve **ölçümde hiçbir şeyi değiştirmedi**:
9 görev / 4 günde bugüne doğal olarak 2 görev düşerken `ceil(9/4) = 3`; tavanı 2 yapmak zaten
bağlayıcı olmayan bir tavanı biraz daha indirmekti. `anxious` planı mod-yok planıyla **birebir**
aynı çıktı.

Doğrusu, günün orantılı dağıtımda gerçekten aldığı sayıyı saymak:

```js
let naturalToday = 0;
for (let i = 0; i < T; i++) if (targetDayIndex(i, T, A) === 0) naturalToday++;
const todayCap = Math.max(1, naturalToday + moodDelta);
const restCap  = Math.max(base, Math.ceil((T - todayCap) / (A - 1)));   // base = ceil(T/A)
```

`restCap`'teki `base` tabanı da ölçümle geldi: onsuz `hyper` senaryosu **çakışan takvim
etkinlikleri** üretti. Sebep, yerleştirmenin orantılı olması — bugün kapasitesini kullanmayabilir;
kalan günleri eskisinden dar bırakırsan görevler taşma dalına düşüp `session.start`'a zorlanır
ve üst üste binerler.

## Karar 4 — iyi mod bugünü ZORLA doldurmaz (asimetri)

`moodDelta > 0` tavanı yükseltir ama bugüne görev **çekmez**; ölçümde `hyper` dağılımı mod-yok
ile aynı çıkıyor. İki gerekçeyle böyle bırakıldı:

1. Çekmesi `targetDayIndex`'i oynatmayı gerektirir; gün dağıtımı 2026-08-28 spec'inde bilerek
   donduruldu.
2. İstenir bir şey de değil. İyi bir güne fazladan iş yığmak, aynı uygulamanın hiperfokus
   alarmıyla önlemeye çalıştığı çöküşün ta kendisi.

İyi modun etkisi AI prompt'unda kalır: daha iddialı, daha derin görevler. Orası işin
**büyüklüğünü** değiştirir, günün sayısını değil.

## Değişen yerler

| yer | değişiklik |
|---|---|
| `scheduling-logic.js` | yeni saf fonksiyon `dailyCaps()` + testleri |
| n8n `Normalize & Calculate` | `moodDelta` üretilip çıktıya eklendi; ölü `effectiveFocus` silindi |
| n8n `Code in JavaScript` | `maxPerDay` → `dailyCaps()`; `sessions[]`'a `isToday` bayrağı |

Ölü `effectiveFocus`: `hyperfocusLimit`'e göre seans süresini kısaltıyordu ama **hiçbir yerde
okunmuyordu** ve alanın arayüzdeki sözüne aykırıydı. Uyarı artık gerçek bir alarm
(bkz. `2026-08-30-hiperfokus-alarmi-design.md`), bu hesap da gereksiz.

## Ölçüm

9 görev / 4 gün, aynı profil:

| mod | gün dağılımı | görev | çakışma |
|---|---|---|---|
| yok | 2 / 2 / 3 / 2 | 9 | yok |
| `anxious` | **1** / 3 / 3 / 2 | 9 | yok |
| `hyper` | 2 / 2 / 3 / 2 | 9 | yok |

252 senaryoluk regresyon taraması (1–14 gün × 1–20 görev × 6 mod), node kodu yerelde
`new Function('$','$json',src)` ile koşturularak:

- **değişiklik öncesi (HEAD): 36 sorunlu senaryo**
- **değişiklik sonrası: 27** — regresyon **yok**, 9 çakışma senaryosu düzeldi
  (`anxious`/`foggy`/`crash` + sıkışık teslim üçlüleri).

## Bu spec'in çözmediği, AYNI GÜN ayrıca çözülen sorun

> **Güncelleme (2026-08-30, aynı gün):** aşağıdaki taşma çakışması düzeltildi —
> bkz. `2026-08-30-tasma-cakismasi-design.md`. Bölüm, teşhis kaydı olarak duruyor.

## Bilinen sorun (o an için)

Kalan 27 senaryonun hepsi **kapasiteyi aşan planlar** (ör. 1 güne 20 görev). Yerleştirici tüm
günler dolduğunda `session = sessions[A-1]; startAbs = session.start` ile son seansa **zorluyor**;
bu dal doluluk kontrolü yapmadığı için aynı saate birden çok etkinlik yazılıyor. Değişiklikten
ÖNCE de aynen böyleydi. Ayrı iş.
