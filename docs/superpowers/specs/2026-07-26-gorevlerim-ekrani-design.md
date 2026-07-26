# FocusAid — "Bugün" (Görevlerim) Ekranı — Tasarım

**Tarih:** 2026-07-26
**Durum:** Onaylandı, uygulamaya hazır
**Kapsam:** Ön yüz. n8n workflow'una ve veritabanı şemasına değişiklik yok.

## Problem

n8n, parçaladığı mikro görevleri Supabase `tasks` tablosuna yazıyor; `completed BOOLEAN DEFAULT false`
kolonu da mevcut. Ancak ön yüz `tasks` tablosunu hiç okumuyor — uygulama yalnızca Google Calendar'dan
etkinlik çekiyor. Sonuç: parçalanan görevleri listeleme, tamamlama ve ilerleme görme yok. DEHB
uygulamasında tamamlama/ödül döngüsünün oturduğu yer tam olarak burası.

## Amaç

Gün içinde açık durup "sırada ne var" sorusunu cevaplayan bir odak aracı. Sabah brifingi veya akşam
raporu değil; çalışırken bakılan ekran.

## Tasarım ilkeleri (DEHB literatür raporundan)

Proje bilgi tabanındaki literatür raporu (`DEHB-Bilgi-Raporu.md`) iki ilkeyi dayatıyor:

1. **Barkley — temporal miyopi / dışsallaştırma.** DEHB bir "bilgi" değil "eylem" problemidir: kişi ne
   yapacağını bilir, o anda yapamaz. Çözüm, kuralların, zamanın ve ödülün eylem anında fiziksel olarak
   dışsallaştırılması. BDT bölümü bunu tamamlar: *"Gözden uzak olan akıldan da uzaktır; göz önünde
   olan akıldadır."* → Gecikmiş görev **görünür kalmalı**; kullanıcıya bilgi değil **eylem** sunulmalı.
2. **RSD / yıkıcı içsel eleştiri.** Aynı rapor, yetişkin DEHB'de BDT'nin özellikle reddedilme
   hassasiyetini ve yıkıcı öz-eleştiriyi hedeflediğini belirtiyor. Uygulamanın profilinde zaten
   `rsd-level` sliderı var. → Kırmızı "GECİKTİ" damgası, sayaçlı ayrı "Gecikenler" bölümü **yok**.

Bu ikisinin kesişimi: **yargısız görünürlük + tek tıklık eylem.**

## Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Yerleşim | Sidebar'a 4. sekme, yeni `tpl-today` şablonu; açılış sayfası olur | Mevcut `loadPage`/`<template>` mimarisine sıfır sürtünme; sade ekran = odak |
| Gecikmiş görev | Listede kalır, gri "dün"/"3 gün önce" rozeti + tek tıkla "Sonraya al" | Görünürlük (Barkley) + yargısızlık (RSD) |
| Tamamlama | Supabase `completed=true` **ve** Google etkinliğine ✓ + yeşil renk | Kullanıcı tercihi; takvimde de görünür olsun |
| Doğruluk kaynağı | Supabase. Takvim senkronu best-effort, başarısızlığı akışı bozmaz | Google token'ı ~1 saatte ölüyor, otomatik yenileme yok |
| Erteleme | +60 dk, süre korunur; mesai sonunu aşarsa yarının mesai başına | Tek tık, karar yükü yok |
| Kapsam sınırı | Sidebar'da kalıcı "sıradaki görev" şeridi bu spec'te YOK | YAGNI; ekran oturduktan sonra ~10 satırlık ek |

## Veri katmanı

Mevcut `sb` istemcisi, user-JWT, RLS üzerinden. **Yeni SQL gerekmiyor** — `fix-tasks-rls.sql`'deki
SELECT ve UPDATE politikaları (`auth.uid() = user_id`) yeterli.

```js
sb.from('tasks').select('*')
  .gte('day', <bugün - 7 gün>)   // 'YYYY-MM-DD'
  .lte('day', <bugün>)           // 'YYYY-MM-DD'
  .order('start_time', { ascending: true })
```

**Tarih hesabı yerel saatle yapılır, UTC ile değil.** `new Date().toISOString().slice(0,10)` UTC
döndürür; Istanbul UTC+3 olduğu için gece 00:00–03:00 arasında bir gün geriyi gösterir ve liste yanlış
günü yükler. `day` string'i yerel tarihten üretilmeli (ör. `toLocaleDateString('sv-SE')` → `YYYY-MM-DD`).
`start_time`/`end_time` TIMESTAMPTZ olduğu için `new Date(...)` karşılaştırmaları yerel saate doğru
dönüşür, orada ek işlem gerekmez.

Tek sorgu, istemcide ikiye ayrılır:

- **Bugün** (`day = bugün`): tamamlanmış + tamamlanmamış, hepsi gösterilir.
- **Devredenler** (`day < bugün AND completed = false`): aynı listede, gri gün rozetiyle.
- Geçmiş günlerin tamamlananları gösterilmez.

7 günlük tavan listenin süresiz şişmesini engeller.

n8n'in yazdığı alanlar (`Prepare Supabase Payload` node'undan doğrulandı):
`user_id, project_title, name, summary, cognitive_load, day, start_time, end_time,
calendar_event_id, completed`.

### "Sıradaki görev" seçimi

Sırayla ilk eşleşen:

1. `start_time ≤ şimdi < end_time` olan tamamlanmamış görev (şu an aktif)
2. Yoksa gelecekteki ilk tamamlanmamış görev
3. Yoksa saati geçmiş ilk tamamlanmamış görev
4. Hiçbiri yoksa "bugün bitti" kutlama durumu

## Ekran anatomisi

| Bölge | İçerik |
|---|---|
| İlerleme şeridi | `Bugün 3/7` + ince çubuk. Tek görünür ilerleme göstergesi (ödülün dışsallaştırılması) |

| Sıradaki görev kartı | `name`, altında `summary`, saat aralığı, `cognitive_load` rozeti. Butonlar: **Tamamlandı**, **Sonraya al** |
| Bugünün listesi | Kompakt satır: saat · ad · onay kutusu. Tamamlananlar **yerinde kalır**, soluk + üstü çizili |
| Devredenler | Aynı liste içinde, gri gün rozeti. Ayrı başlık/sayaç yok |
| Boş durum | "Bugün için planlanmış mikro görev yok" + Parçalayıcı'ya götüren buton |

**İlerleme sayacının paydası** ekranda görünen tüm yapılacaklar havuzudur: bugünün görevleri **artı**
devredenler. Devredenler paydaya dahil edilmezse tamamlandıklarında çubuk 7/7'yi aşar. Yani
`payda = bugünün tüm görevleri + devredenler`, `pay = bunlardan completed olanlar`.

## Etkileşimler

### Tamamlama (iyimser güncelleme)

1. Tıklama anında UI'da ✓ görünür, ilerleme çubuğu artar (bekleme yok).
2. `sb.from('tasks').update({ completed: true }).eq('id', id)`
3. Hata → UI geri alınır + hata toast'ı.
4. Başarı → takvim senkronu denenir (aşağıda).

Tekrar tıklama geri alır (`completed: false`). Ayrı "geri al" düğmesi yok — yanlış işaretleme DEHB'de
sık, geri alma en kısa yolda olmalı.

### Takvim ✓ senkronu (best-effort, ikincil)

`calendar_event_id` ve geçerli `AppState.googleAccessToken` varsa:

```js
gapi.client.calendar.events.patch({
  calendarId: 'primary', eventId: task.calendar_event_id,
  resource: { summary: '✓ ' + task.name, colorId: '10' }   // 10 = yeşil
})
```

- try/catch içinde; **hata yutulur**, ana akış bloklanmaz.
- Başarısızlıkta yalnızca bilgi toast'ı: "görev kaydedildi, takvim güncellenemedi".
- **Supabase yazımı geri alınmaz.** Doğruluk kaynağı Supabase'dir.
- Geri almada `✓ ` başlıktan çıkarılır, renk varsayılana döner.

Gerekçe: Google provider_token ~1 saat yaşıyor ve otomatik yenileme yok (bilinen açık iş). Takvimin
erişilemez olması görev tamamlamayı engellememeli.

### Sonraya al

- `start_time` ve `end_time` +60 dk kaydırılır, süre korunur.
- Yeni `start_time` profildeki `workHours.end`'i aşarsa → yarının `workHours.start` saatine taşınır,
  `day` güncellenir.
- Takvim etkinliği aynı best-effort politikasıyla `patch` ile kaydırılır.
- Profil `localStorage.focusaid_profile`'dan okunur (zaten mevcut).

### Zaman ilerlemesi

Ekran açıkken 60 saniyede bir "sıradaki görev" yeniden hesaplanır — yalnızca istemci tarafı hesap ve
render, ağ isteği yok. Sayfa değişiminde `clearInterval` ile durdurulur.

## Kod yapısı

`index_2.html` şu an 886 satır / 55.7 KB. Bu ekran ~200 satır daha eklerdi, o yüzden bölünüyor:

- **`<template id="tpl-today">`** → `index_2.html` içinde kalır. Projenin bilinçli "fetch yok, CORS yok"
  deseni korunur.
- **`tasks-view.js`** (yeni dosya) → `config.js` gibi `<script>` ile yüklenir. Tek sorumluluk, izole:
  `loadTasks · pickCurrentTask · renderToday · completeTask · snoozeTask · syncCalendarMark · stopTodayTimer`
- `loadPage`'in `inits` haritasına `today` satırı.
- Sidebar'a 4. buton (`nav-today`).
- `DOMContentLoaded` → `loadPage('today')` (şu an `calendar`).

**`index.html` bunun ikizidir** (GitHub Pages giriş noktası; `auth.html` ise `index_2.html`'e yönlendirir).
Aynı değişiklik her iki dosyaya da uygulanmalı, yoksa ikisi ayrışır.

## Bağımlılık

Ekranın veri gösterebilmesi için Workflow #1'in Supabase yazımının canlıda çalışıyor olması gerekir.
Yerel `n8n-workflow-focusaid.json` dosyasında `Save task to Supabase` node'unun header'ları hâlâ
`SERVICE_ROLE_KEY_BURAYA` placeholder'ını taşıyor. O adım canlı n8n'de tamamlanmadıysa `tasks` tablosu
boştur ve ekran boş durumu gösterir. Kod yazımını engellemez; doğrulama aşamasında gerekir.

## Doğrulama

Projede test koşucusu yok (vanilla JS, build adımı yok). Supabase SQL Editor'den elle birkaç satır
eklenip `python -m http.server 3000` ile serve edilerek şu senaryolar gözle doğrulanacak:

1. Boş liste → boş durum ekranı çıkıyor mu
2. Sadece devreden görevler → gri gün rozetiyle görünüyor, kırmızı/uyarı yok
3. Karışık gün (geçmiş + aktif + gelecek) → "sıradaki görev" doğru seçiliyor mu
4. Hepsi tamamlanmış → kutlama durumu, ilerleme 7/7
5. **Takvim bağlı değilken tamamlama** → Supabase yazıyor, hata yutuluyor, bilgi toast'ı çıkıyor (en kritik hata yolu)
6. Ertelemenin mesai sonunu aşması → yarının mesai başına taşınıyor, `day` güncelleniyor
7. Tamamlamayı geri alma → takvim başlığındaki `✓ ` ve renk geri dönüyor

Test için `localhost:3000/auth.html` üzerinden girilmeli (`127.0.0.1` değil — Supabase PKCE origin bağımlı).

## Kapsam dışı

- Sidebar'da kalıcı "sıradaki görev" şeridi (sonraki iş)
- Odak sayacı / Pomodoro
- Mobil uyum (sidebar hamburger)
- Chatbot'un profili budayarak göndermesi bug'ı (`breakStyle` gönderilmiyor) — ayrı iş
- Ölü kod temizliği (`app-core.js`, `n8n-logic.js`, `profile.js`, eski `*.html` sayfaları)
