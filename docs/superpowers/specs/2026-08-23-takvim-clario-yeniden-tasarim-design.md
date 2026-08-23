# Takvim sayfası — Clario tarzı yeniden tasarım

**Tarih:** 2026-08-23
**Durum:** Tasarım onaylandı, uygulama bekliyor

## Sorun

Takvim sayfasının hafta görünümü iki turdur istenen görünüme ulaşamadı:

1. İlk halinde `height:'auto'` + 30 dakikalık slotlar sayfayı ~1400px'e şişiriyordu (32 satır ×
   2.8em). Sabit yükseklik + saatlik slotlarla düzeltildi.
2. Kaydırmayı azaltmak için satır yüksekliği 2.3em'e indirilince bu sefer görev kartları
   başlıkların sığmayacağı kadar kısaldı — kartlar boş renkli kutulara döndü.

Kök neden: kart içeriği tamamen CSS ile boyutlanıyor, kartın gerçek yüksekliğine göre içerik
seçimi yapılmıyor. Saat metni + başlık dar/kısa kutuya her zaman birlikte zorlanıyor, sığmayınca
`overflow:hidden` ikisini birden kırpıyor.

Ayrıca kullanıcı, referans olarak paylaştığı "Clario" tasarımının (koyu tema, sol mini ay takvimi
+ hızlı eylem + haftalık özet, sağda detay paneli) sayfa düzeyinde uygulanmasını istiyor.

## Hedef

Takvim sayfası Clario referansındaki gibi derli toplu görünsün; hafta görünümündeki görev kartları
her zaman okunaklı olsun; aşırı kaydırma gerekmesin.

## Kapsam dışı

- Büyük takvimin event veri kaynağı (Supabase + Google Calendar + dedup mantığı) — çalışıyor,
  dokunulmuyor.
- Ay görünümü — kullanıcı tarafından zaten onaylandı.
- Clario'nun üst menüsü (Marketing/Contacts/Estimates/…) — FocusAid'in sol ana navigasyonu
  korunuyor, üst menü eklenmiyor.

## Mimari

`tpl-calendar` şablonu üç kolona ayrılıyor:

| kolon | genişlik | içerik |
|---|---|---|
| Ana menü | ~180px | Mevcut sidebar (Bugün/Takvim/…) — **değişmiyor** |
| Takvim yan paneli | ~260px | **YENİ**: mini ay takvimi + haftalık özet + "+ Yeni Görev" |
| Büyük takvim | flex-1 | Mevcut FullCalendar |

Sağdaki `task-form-panel` yapısal olarak yerinde kalıyor, yalnızca görsel olarak yeniden
stillendiriliyor.

Mini takvim ikinci bir FullCalendar örneği DEĞİL — saf vanilla-JS bir grid. İkinci bir
FullCalendar örneği bu iş için gereksiz ağır olurdu.

## Bileşenler

### 1. Mini ay takvimi — `renderMiniCalendar()`

- Paz–Cmt sütun başlıkları + ay gün ızgarası, prev/next ok butonları.
- Bugün ve seçili gün ayrı vurgulanır.
- Güne tıklama → `AppState.calendar.gotoDate(dateStr)`.
- Kendi görünen ay/yıl state'ini tutar.

### 2. Haftalık özet kartı — `renderWeekOverview()`

- **Bugünü içeren** hafta (Pzt–Paz) için tek Supabase sorgusu (`gte/lte day`, `completed`).
- "X/Y tamamlandı" metni + ilerleme çubuğu.
- Büyük takvimin gezinmesinden **bağımsız** — her zaman "bu hafta"yı gösterir. Kullanıcı geçmiş
  haftalara giderken özetin değişmemesi bilinçli bir karar (YAGNI: gezinmeyle senkron tutmak
  ek karmaşıklık, karşılığı yok).
- Yenilenme: Takvim sayfası her açıldığında. Görev tamamlanınca anlık güncelleme yok.

### 3. Kart içeriği — `eventContent(arg)` callback'i

Mevcut CSS-tabanlı yaklaşımın yerine geçer, yukarıdaki kök nedeni çözer:

- Event süresi **≥ 45 dakika** → başlık + saat aralığı.
- Event süresi **< 45 dakika** → yalnızca başlık, tek satır, ellipsis ile kırpılır.

Böylece kısa görevler asla içeriksiz renkli kutu gibi görünmez.

### 4. Renk dili

Uygulama genelindeki bilişsel yük renkleriyle tutarlı (Bugün ekranındaki `YUK_KENAR` ile aynı
anlam ekseni):

| kaynak | renk |
|---|---|
| Hafif görev | emerald-600 |
| Orta görev | amber-600 |
| Ağır görev | rose-600 |
| Yalnızca Google Calendar'da olan etkinlik | purple-600 |
| Mola | teal-600 |

Dolgu koyu/doygun, yazı beyaz — hem açık hem koyu temada okunur.

Satır yüksekliği ~2.8em'e geri çekilir (16 saat ≈ 717px). ~700px'lik kutunun başlık satırı
düşüldükten sonraki görünür alanına göre ~70–100px'lik hafif bir taşma kalır — kartların okunaklı
kalması için kabul edilen bilinçli bir denge, "sürekli kaydır kaydır" değil. Uygulamada gerçek
değer tarayıcıda ölçülüp doğrulanmalı (ölçüm yöntemi: `.fc-scroller` üzerinde
`scrollHeight` vs `clientHeight`).

### 5. Form ve gün modalı

Yalnızca görsel: sabit `bg-white` / `text-slate-*` sınıflarından mevcut tema token'larına
(`var(--glass-white)`, `var(--border-light)`, `var(--text-main)`) geçiş. İşlevsellik aynı.

## Veri akışı

```
loadPage('calendar')
  └─ initCalendar()          ← mevcut giriş noktası (index.html:1869)
       ├─ büyük FullCalendar (mevcut: Supabase + GCal + dedup)
       ├─ renderMiniCalendar()      (veri çekmez, saf tarih hesabı)
       └─ renderWeekOverview()      (kendi Supabase sorgusu)
```

**Senkron yönleri:**

- mini takvim → büyük takvim: `gotoDate()`
- büyük takvim → mini takvim: `datesSet` içinde, **yalnızca görünen ay değiştiyse** yeniden çizim
  (sonsuz döngü koruması)

## Hata yönetimi

`initCalendar` zaten try/catch ile sarılı ve çökerse görünür kırmızı mesaj basıyor — korunur.

`renderMiniCalendar` ve `renderWeekOverview` kendi try/catch'lerine alınır ve **birbirini
düşürmez**: özet kartı sorgusu patlarsa kart "—" gösterir, mini takvim ve büyük takvim çalışmaya
devam eder. (DEHB Bilgisi slider'ındaki dersle aynı çizgide: yan bileşen ana içeriği kilitlememeli.)

## Test

Mini takvimin tarih ızgarası hesabı saf bir fonksiyon olarak `calendar-logic.js`'e çıkarılır ve
`node --test` ile test edilir:

- ayın ilk gününün haftanın hangi gününe düştüğü
- ay başı/sonu taşmaları (önceki/sonraki aydan görünen günler)
- artık yıl (29 Şubat)

Bu, projedeki mevcut "saf hesap `*-logic.js`'e, DOM ve ağ `*-view.js`'e" ayrımını korur.

DOM render ve FullCalendar entegrasyonu tarayıcıda elle doğrulanır.

## Ek temizlik

Bu turda hafta görünümü teşhisi için geçici eklenen `unhandledrejection` / `error` global
handler'ları ve kırmızı hata kutusu **kaldırılır** — çökme tekrarlamıyor, işini gördü.
