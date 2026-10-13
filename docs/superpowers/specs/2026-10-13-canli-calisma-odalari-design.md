# Canlı çalışma odaları (kameralı body doubling)

**Tarih:** 2026-10-13
**Durum:** Uygulandı (dal `canli-odalar`, commit'siz) — plan `docs/superpowers/plans/2026-10-13-canli-calisma-odalari.md`; canlıya çıkış Daily anahtarı + SQL bekliyor

## Sorun

📺 Çalışma Odaları bugün yalnız YouTube "study with me" videoları. Body doubling'in asıl gücü
**gerçek ve şu an orada olan** birinin varlığı; kayıtlı video bunu yarım veriyor. Rakip taramasında
(Obsidian `wiki/projeler/focusaid-rakip-analizi.md`) Türkçe, DEHB'ye özgü, planlayıcıyla bağlı canlı
oda sunan ürün görülmedi.

## Hedef

- FocusAid kullanıcılarının **kameralı** ortak odalarda birlikte çalışması.
- Odanın DEHB'ye uygun olması: kimseyi bölmeyen, girip çıkmayı gerektirmeyen, sakin.
- Seansın sonucunun (hedef + süre) çalışma analizine akması.
- Ücretsiz kotada kalmak; kotayı **sunucu** korur, istemciye güvenmez.

## Kapsam dışı

- Mikrofonla sohbet odası (mikrofon kapalı varsayılan; açılabilir ama tasarım sohbete göre değil).
- Kullanıcının kendi özel odasını açması / arkadaş davet linki (sonraki tur; Meet linki fikri ayrı).
- Kayıt (recording) — **hiç** açılmaz.
- Misafir modu — canlı odalar yalnız Google ile girişli kullanıcıya.
- Oda içi sohbet (chat) — dikkat dağıtır; yalnız durum kartı var.
- Self-host LiveKit'e geçiş — kullanım ücretsiz kotayı aşınca ayrı spec.

## Kullanıcı kararları

| Soru | Karar |
|---|---|
| Altyapı | **Daily.co** (gömülebilir, 10.000 katılımcı-dk/ay ücretsiz). Meet elendi (gömülmüyor, kim var göremiyoruz). Büyürse Oracle'da self-host LiveKit. |
| Kamerasız Presence | **Reddedildi** — insanlar birini görmek için giriyor, kamera ana özellik. |
| Sabit seans süresi (50 dk sonra oda kapanır) | **Reddedildi** — hiperodakta 1-2 saat kalan bölünmemeli. |
| Odaya girip çıkma | **Oda kalıcı**, bir kez girersin; mola dahil odada kalırsın. |
| Sayaç | **Kişiye özel**: herkes kendi süresini seçer; bitince atılmaz, "mola mı devam mı" sorulur. |
| Kota koruması | Sabit süre yerine **boşta kalma kontrolü + kişi başı günlük üst sınır**. |

## Mimari

```
Tarayıcı (live-rooms.js + daily-js call object)
   │  1) POST /api/rooms/token {supabaseToken, room}
   ▼
serve.py ── dogrula_supabase_kullanicisi ──► Supabase /auth/v1/user
   │  2) günlük kullanım kontrolü (room_sessions, kullanıcının token'ıyla)
   │  3) Daily REST: POST /meeting-tokens (DAILY_API_KEY sunucuda)
   ▼
Tarayıcı ── 4) call.join({url, token}) ──► Daily SFU (görüntü)
         ── 5) room_sessions satırı (Supabase, RLS) ──► analiz
```

| Aday | Karar |
|---|---|
| A. Daily **call object** + kendi kutucuk ızgaramız | ✅ Seçildi. Kamerasız katılanın **hedef kartı**, "☕ molada" rozeti ve sakin görünüm ancak kendi arayüzümüzle olur. 6 kişilik ızgara küçük iş. |
| B. Daily Prebuilt (hazır iframe) | ❌ Hızlı ama kendi düğmeleri/ızgarası var; hedef kartı ve mola durumu gösterilemez, görünüm FocusAid'e uymaz. |
| C. Supabase Realtime + kendi WebRTC | ❌ 3+ kişide SFU şart; TURN/SFU işletmek bu aşamada fazla. |

- `@daily-co/daily-js` tam sürümle (`unpkg`/`jsdelivr`, sürüm pinli) **yalnız odaya girerken**
  dinamik yüklenir; diğer sayfaları ağırlaştırmaz.
- **Durum paylaşımı** (hedef cümlesi, odak/mola, sayacın bitiş anı) Daily'nin
  `setUserData` alanıyla taşınır — ek bir gerçek zamanlı kanal gerekmez.
- **Lobideki "odada 3 kişi"** bilgisi: `GET /api/rooms/presence` → sunucu Daily
  `GET /rooms/:name/presence` çağırır, 15 sn önbellekler. Yalnız sayı + ad baş harfleri döner.

## 1. Odalar

Kalıcı, sabit 3 oda — Daily'de **bir kez** oluşturulur (`scripts/daily-odalar.mjs`, idempotent):

| id | Ad | Not |
|---|---|---|
| `canli-kutuphane` | 📚 Sessiz Kütüphane | genel |
| `canli-sabah` | ☀️ Sabah Kulübü | gün içi |
| `canli-gece` | 🌙 Gece Kuşları | akşam/gece |

Oda ayarları (Daily room properties): `privacy: private` (token şart), `max_participants: 6`,
`enable_recording: off`, `enable_chat: false`, `start_video_off: false`, `start_audio_off: true`,
`enable_prejoin_ui: false`. Oda **süresiz** (`exp` yok); boş oda ücret yazmaz.

Doluysa (6/6) kart "Dolu" gösterir ve diğer odayı önerir. Oda sayısı ileride `CANLI_ODALAR`
listesine eklenerek artar.

## 2. Sunucu: `/api/rooms/token`, `/api/rooms/presence`

`serve.py`'ye iki uç; **ikisi de** `dogrula_supabase_kullanicisi` ile korunur (⚠️ CLAUDE.md kuralı).

**`POST /api/rooms/token`** gövde `{supabaseToken, room}`:
1. Token doğrula → `user_id`; yoksa 401.
2. `room` beyaz listede değilse 400 (serbest metin Daily'ye gitmez).
3. Bugünkü kullanım: kullanıcının token'ıyla Supabase REST'ten bugünkü (Europe/Istanbul)
   `room_sessions.active_seconds` toplamı. `GUNLUK_LIMIT_DK` (env, varsayılan **240**) dolmuşsa
   `429 {error:'daily_limit', kalanDk:0}`.
4. Daily `POST /meeting-tokens`:
   `room_name`, `user_name` (profildeki ad, 40 karakter), `user_id`,
   `exp` = şimdi + 10 dk (**katılma** süresi; odadaki kişiyi atmaz),
   `eject_after_elapsed` = kalan günlük kota (sn) — kotayı Daily'nin kendisi uygular,
   `enable_recording: false`, `start_audio_off: true`.
5. Dönüş `{url, token, kalanDk}`. `DAILY_API_KEY` yoksa 503 `not_configured` → arayüz
   "Canlı odalar şu an kapalı" der, video odaları çalışmaya devam eder.

**`GET /api/rooms/presence`** (`Authorization: Bearer <supabaseToken>`): 3 oda için
`{id, sayi, dolu}`; 15 sn bellek önbelleği (Daily API sınırına takılmamak için).

Yeni ortam değişkenleri (Render): `DAILY_API_KEY`, `DAILY_DOMAIN`, isteğe bağlı `GUNLUK_LIMIT_DK`.
Günlük toplamın istemcinin yazdığı satırdan gelmesi, kullanıcının kendi kotasını "aldatabilmesi"
demek; zararı yalnız ücretsiz kota olduğu ve `eject_after_elapsed` + `max_participants` ayrıca
sınırladığı için bu aşamada kabul edildi.

## 3. Odadaki deneyim

**Girişte (tek ekran, 5 saniyelik iş):**
- Hedef cümlesi (isteğe bağlı, 80 karakter): "Bu oturumda ne yapacaksın?" — Bugün'deki görevlerden
  tek dokunuşla seçilebilir.
- Süre seçimi: **25 / 50 / 60 / 90 / Serbest** (varsayılan profildeki `focusPeriod`).
- Kamera önizlemesi + "kamerasız katıl" seçeneği. İlk girişte KVKK onayı (§6).

**Içeride:**
- 6 kutucuklu sakin ızgara. Kamera kapalı olan kişi = baş harfi + hedef cümlesi kartı.
- Her kutucukta küçük durum rozeti: `🎯 odakta · 32 dk kaldı` / `☕ molada`.
- Görüntü düşük çözünürlük (`sendSettings` ~360p, 15 fps) — hem dikkat hem bant genişliği.
- Mikrofon kapalı başlar; açılabilir (sessiz oda adabı metniyle).
- Kendi sayacın sağda, mevcut oda sayacı bileşeni yeniden kullanılır (halka + süre).
- **Bir kişiyi kendi ekranından gizle** (sadece sende; rahatsız edici görüntüye karşı) ve
  **Bildir** (e-posta ile bize; ilk sürümde moderasyon elle).

**Sayaç bitince — atılmazsın:**
- "⏱ Süren doldu. **Mola ver** (profildeki mola süresi) / **Devam et** (+ aynı süre) / **Bitir**".
- Mola: kamera kendiliğinden kapanır (isteğe bağlı tercih), rozet "☕ molada"; odadan çıkılmaz.
- Cevap verilmezse sayaç "Serbest" moda geçip saymaya devam eder — hiperodaktakini bölmeyiz.

**"Sürekli odaya girme" olmasın:**
- Odadan çıkmadan mola; sayfa içi gezinmede (Bugün'e bakmak) bağlantı **kopmaz** — oda küçük
  bir yüzen pencereye (mini görünüm) iner. (Mevcut Document PiP deneyimi varsa ona bağlanır.)
- Lobide **"Son odana dön"** tek tık.

**Boşta kalma kontrolü (kotayı korur):**
- Ölçüt yalnız **etkileşim**: FocusAid sekmesinde/penceresinde son fare/klavye/dokunma ya da
  sayaç düğmesinden **90 dk** sonra. Yüz algılama yok (gizlilik).
- ⚠️ `loadPage` bugün sayfa değişince `odalardanAyril()` çağırıyor; canlı odada bu çağrı Daily
  bağlantısını **koparmamalı**, yalnız mini görünüme indirmeli.
- "👋 Hâlâ burada mısın?" kartı; **5 dk** cevap yoksa nazikçe çıkış + "seni odadan çıkardık,
  tek tıkla dön" bildirimi. Hiperodakta klavye kullanan biri bu kartı hiç görmez.

## 4. Veri modeli — `room_sessions`

Yeni tablo (`add-room-sessions.sql`, kullanıcı SQL Editor'de çalıştırır):

| Alan | Tip | Anlamı |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → auth.users | RLS: yalnız kendi satırı |
| `room` | text | `canli-kutuphane` vb. |
| `joined_at` / `left_at` | timestamptz | |
| `active_seconds` | int | odada geçen (mola dahil değil) |
| `focus_seconds` | int | sayaç odak fazında geçen |
| `planned_minutes` | int | seçilen süre (Serbest = NULL) |
| `goal` | text (≤80) | hedef cümlesi |
| `goal_met` | text CHECK ('yes','partly','no') | çıkışta sorulan |
| `task_id` | uuid NULL → tasks | hedef bir görevden seçildiyse |

4 RLS politikası (select/insert/update/delete own) — `brain_dump` deseni. İndeks `(user_id, joined_at)`.

Satır **girişte** açılır, sayaç ilerledikçe 60 sn'de bir `active_seconds`/`focus_seconds`
güncellenir (sekme kapanırsa en fazla 1 dk kayıp), çıkışta `left_at` + `goal_met` yazılır.

## 5. Çalışma analizine bağlantı

- Çıkışta: "🎯 Hedefine ulaştın mı? **Evet / Kısmen / Hayır**" (tek dokunuş, atlanabilir).
- Hedef bir görevden seçildiyse ve "Evet" → o görev tamamlandı önerisi (onayla) ve odadaki
  `focus_seconds` görevin `active_seconds`'ına eklenir → mevcut kalibrasyon aynen işler.
- Profil > Çalışma Analizim kartına tek satır: "Bu hafta odalarda **4 sa 20 dk**, hedeflerin
  **%70**'ine ulaştın." `analysis-logic.js`'e saf fonksiyon olarak eklenir.
- Odak süresi önerisi bu turda oda verisini **kullanmaz** (veri birikince ayrı karar).

## 6. Gizlilik / KVKK

- İlk girişte tek seferlik onay kartı: görüntü yalnız o an odadakilere gider, **kaydedilmez**;
  altyapı Daily.co (ABD) — yurt dışı aktarım açıkça yazılır; kamerasız katılım her zaman mümkün.
  Onay `profiles.room_consent_at` (timestamptz) alanına yazılır.
- Daily'ye giden kimlik: yalnız görünen ad + `user_id`; e-posta gitmez.
- `room_sessions` yalnız kullanıcının kendisine görünür (RLS); diğer katılımcılar yalnız Daily
  üzerindeki anlık `userData`'yı (hedef + durum) görür, geçmişi görmez.

## 7. Dosyalar

| Dosya | İş |
|---|---|
| `live-rooms-logic.js` (yeni) | Saf: `CANLI_ODALAR`, süre seçenekleri, kalan kota hesabı, boşta durumu, `userData` temizleme (hedef metni 80 karakter, beyaz liste alanlar), seans özeti. `node --test`. |
| `live-rooms.js` (yeni) | daily-js yükleme, giriş ekranı, ızgara, sayaç bağlantısı, boşta kontrolü, `room_sessions` yazımı. |
| `study-rooms.js` / `index.html` | Sayfa iki bölüm: **🟢 Canlı Odalar** (üstte, içinde kişi olanlar başa) + **📺 Video Odaları** (mevcut, değişmez). |
| `serve.py` | 2 uç + Daily REST yardımcıları; testleri `test/` altında (Daily sahte). |
| `analysis-logic.js` / `analysis-view.js` | Haftalık oda satırı. |
| `add-room-sessions.sql` | Tablo + RLS + `profiles.room_consent_at`. |
| `scripts/daily-odalar.mjs` | 3 odayı Daily'de oluştur/güncelle (idempotent). |
| `test-ui/` | daily-js sahte nesneyle: giriş, kamerasız kart, sayaç bitince atılmama, boşta çıkış. |

## 8. Test ve canlıya çıkış

1. Birim: `live-rooms-logic` + `serve.py` uçları (401 kimliksiz, 400 bilinmeyen oda, 429 limit,
   503 anahtarsız). Tam set `node --test` + `npm run test:ui` yeşil.
2. **SQL ÖNCE** (`add-room-sessions.sql`), sonra Render env (`DAILY_API_KEY`, `DAILY_DOMAIN`),
   sonra `scripts/daily-odalar.mjs`, sonra deploy.
3. Canlıda iki tarayıcı/iki hesap ile gerçek görüntülü deneme: görüntü, kamerasız kart, mola
   rozeti, sayaç bitince kalma, çıkış sorusu → `room_sessions` satırı → analiz kartı.

## Kullanıcıdan gerekenler

- daily.co ücretsiz hesap → **API key** + alan adı (`xxx.daily.co`). Kod anahtar olmadan yazılır;
  anahtarsızken canlı odalar "kapalı" görünür, gerisi etkilenmez.
- SQL Editor'de `add-room-sessions.sql` çalıştırmak.

## Varsayılanlar (değiştirilebilir)

Oda sayısı 3 · oda başı 6 kişi · günlük limit 240 dk · boşta uyarısı 90 dk etkileşimsizlik,
5 dk cevap süresi · süre seçenekleri 25/50/60/90/Serbest · görüntü ~360p.
