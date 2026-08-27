# FocusAid — DEHB Odak Asistanı

DEHB'li kullanıcılar için yapay zeka destekli görev parçalama ve takvim planlama uygulaması. Bir görev tanımlarsın, AI ajanı onu odaklanılabilir seanslara böler ve Google Takvime otomatik ekler.

## 🌐 Canlı Demo

**[https://dehb-asistan.onrender.com](https://dehb-asistan.onrender.com)**

Google hesabınla giriş yap, kullanmaya başla — **kurulum gerekmiyor.** Parçalayıcı dahil tüm
özellikler canlıda çalışıyor: n8n otomasyon sunucusu Oracle Cloud'da 7/24 ayakta, yani senin
bilgisayarın kapalıyken de görev parçalama çalışır.

Arayüz açık/koyu tema destekliyor (sidebar'daki 🌗 anahtarı, tercih hesaba kalıcı kaydediliyor).
"Projelerim" sayfası, parçalanan görevleri proje bazında gruplayıp tek tıkla (bağlı Google Calendar
etkinlikleriyle birlikte) silmeyi sağlıyor.

**Takvim** sayfası üç kolonlu: solda mini ay takvimi (büyük takvimle çift yönlü senkron) ve haftalık
tamamlanma özeti, sağda ay/hafta görünümü. Türkçe locale yüklü, hafta Pazartesi'den başlıyor. Hafta
görünümündeki kartlar bilişsel yüke göre renklendiriliyor (hafif/orta/ağır) ve içerikleri görevin
süresine göre seçiliyor — kısa görevlerde saat gizlenip başlık korunuyor, böylece hiçbir kart
okunamaz hale gelmiyor. Bir güne tıklayınca o günün görevleri açılıyor; geçmiş günlere görev
eklenemiyor ve gün zaten doluysa (5+ görev) uyarı veriliyor. Google Calendar'ın tüm gün süren
etkinlikleri (tatil, izin vb.) hafta görünümünde üstteki "Tüm gün" şeridinde gösteriliyor.

Görev formunda tek bir **Ekle** butonu var; üstündeki **"🧩 AI ile parçalara böl"** kutusu varsayılan
olarak açık ve hangi yolun izleneceğini belirliyor. İşaretliyse görev n8n'e gidip mikro adımlara
bölünüyor; işaretli değilse tek görev olarak kaydediliyor.

Her iki yol da Supabase'i kaynak doğruluk kabul ediyor. Tek görev kaydında satır önce `tasks`
tablosuna yazılıyor, Google Calendar bağlıysa etkinlik oraya da açılıp `calendar_event_id` ile
eşleniyor (takvim bu alanla tekilleştirdiği için görev iki kez görünmüyor); bağlı değilse görev yine
kaydediliyor ve kullanıcı bilgilendiriliyor.

## Nasıl Çalışır

```
Tarayıcı  ──POST /api/n8n/split──►  serve.py (Render)
                                      │  Supabase token'ını doğrular,
                                      │  gövdedeki userId'yi ezer,
                                      │  X-Focusaid-Secret başlığını ekler
                                      ▼
                                    n8n (Oracle Cloud, HTTPS + Header Auth)
                                      │
                                      ├─► AI Agent (Google Gemini) görevi mikro parçalara böler
                                      ├─► Code node tarih/saat yerleştirmesini yapar
                                      ├─► Google Calendar etkinlikleri oluşturulur
                                      └─► Görevler Supabase'e kaydedilir
                                      ▼
                                    Tarayıcıda FullCalendar'da görünür
```

Tarayıcı n8n'in gerçek adresini **hiç görmüyor** — istek `serve.py` üzerindeki vekil uçlardan
geçiyor ve gizli anahtar yalnızca sunucu tarafında ekleniyor. Ayrıntı için [Mimari ve
Güvenlik](#mimari-ve-güvenlik).

AI Agent, deadline'dan geriye doğru `target_tasks = round(available_days × 0.6)` adet görev üretir;
tarih/saat yerleştirmesini Code node'daki algoritma yapar (LLM'e bırakılmaz).

Ayrıca haftalık bir **rapor akışı** var: her Pazartesi 07:00'de o haftanın görevlerini Supabase'ten
çekip kullanıcı bazında gruplayarak Gemini'ye özetletiyor ve Gmail üzerinden mail atıyor. O hafta
hiç görevi olmayan kullanıcıya mail gönderilmiyor.

## Mimari ve Güvenlik

Uygulama iki ayrı sunucudan oluşuyor:

| Bileşen | Nerede | Görevi |
|---------|--------|--------|
| `serve.py` | Render | Statik dosyalar, config enjeksiyonu, Google token yenileme, n8n vekili |
| n8n | Oracle Cloud (VM.Standard.E2.1.Micro) | Görev parçalama, dosya analizi, haftalık rapor |

**n8n webhook'ları neden vekilin arkasında:** webhook'un arkasında RLS'i tamamen atlayan Supabase
`service_role` anahtarı var. İstemciye konan hiçbir anahtar sır olamayacağı için (sayfa kaynağından
okunur) n8n adresi ve gizli anahtarı tarayıcıya hiç verilmiyor.

Vekil iki iş yapıyor:

1. Supabase access token'ını `/auth/v1/user` ile **doğruluyor**
2. Gövdedeki `userId`'yi doğrulanan kimlikle **eziyor** — bu olmadan istemci payload'a başkasının
   userId'sini yazıp o kullanıcının takvimine görev ekletebilirdi

n8n tarafında her iki webhook (`focusaid-processor`, `focusaid-analyze`) **Header Auth** ile
korunuyor: `X-Focusaid-Secret` başlığı olmayan istek `403` alıyor. Anahtar Render'da `N8N_SECRET`
ortam değişkeninde.

Supabase `service_role` anahtarı n8n'de workflow parametrelerinde değil, **credential** olarak
tutuluyor — böylece şifreli saklanıyor ve workflow dışa aktarıldığında JSON'a sızmıyor.

## Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Vanilla HTML/JS + Tailwind CSS + FullCalendar |
| Auth | Supabase (Google OAuth) |
| Uygulama sunucusu | Python `http.server` (`serve.py`), Render'da barındırılıyor |
| Otomasyon | n8n — Oracle Cloud'da self-hosted, Caddy + Let's Encrypt + DuckDNS |
| AI | Google Gemini (n8n AI Agent node) |
| Veritabanı | Supabase (PostgreSQL, RLS açık) |

## Yerel Geliştirme

> Uygulamayı **kullanmak** için buraya hiç ihtiyacın yok — [canlı demo](#-canlı-demo) yeterli.
> Bu bölüm yalnızca projeyi fork'layıp üzerinde geliştirme yapacaklar için.

```bash
cp config.example.js config.js   # kendi Supabase/Google değerlerini gir
python serve.py                   # http://localhost:3000
```

Tarayıcıda `http://localhost:3000/auth.html`.

Birkaç not:

- **`config.js` içindeki `N8N_WEBHOOK` / `N8N_ANALYZE_WEBHOOK` değerleri kullanılmıyor.** `serve.py`
  bu alanları her zaman kendi vekil uçlarıyla (`/api/n8n/split`, `/api/n8n/analyze`) eziyor. n8n'in
  gerçek adresleri sunucu tarafındaki `N8N_WEBHOOK` / `N8N_ANALYZE_WEBHOOK` ortam
  değişkenlerinden okunuyor.
- Sunucu tarafında `GOOGLE_CLIENT_SECRET` tanımlı olmalı; tarayıcıya hiç gönderilmiyor, yalnızca
  `/api/google/refresh` ucu süresi dolan Google token'ını sessizce yenilemek için kullanıyor.
  Tanımlı değilse uygulama çalışır, sadece otomatik yenileme devre dışı kalır.
- Uygulama auth-gated olduğu için yerelde oturum yoksa doğrudan `auth.html`'e atar. Supabase
  Dashboard → Authentication → URL Configuration → Redirect URLs listesine
  `http://localhost:3000/index_2.html` ekli olmalı.

**Veritabanı:** `schema.sql`'i Supabase SQL Editor'de çalıştır. Var olan bir kurulumu
güncelliyorsan `add-google-refresh-token.sql` ve `fix-tasks-*.sql` dosyalarını da çalıştır
(hepsi idempotent).

**Kendi n8n'ini kurmak istersen:** tam kurulum kiti `infra/n8n/` altında — `kur.sh`,
`docker-compose.yml`, `Caddyfile`, `oracle-cloud-init.txt` ve adım adım `KURULUM.md`.
Workflow tanımları (`n8n-workflow-*.json`) **ayrı ayrı** import edilmeli; hepsi tek canvas'a
yapıştırılırsa tek bir Publish anahtarına bağlanır ve bir credential eksikliği diğer akışları da
bloke eder.

**Testler:** `node --test test/`

## Dosya Yapısı

```
├── auth.html          # Google OAuth giriş sayfası
├── index.html         # Ana uygulama (Bugün + Takvim + Parçalayıcı + Projelerim + Profil + DEHB Bilgisi)
├── index_2.html       # index.html'e yönlendirme köprüsü (Supabase redirect URL'i buraya kayıtlı)
├── serve.py           # Uygulama sunucusu: statik dosyalar + config enjeksiyonu + n8n vekili
│                      #   + /api/google/refresh
├── tasks-logic.js     # Görev mantığı — DOM'suz, test edilebilir
├── tasks-view.js      # Görev ekranı render + Supabase/GAPI çağrıları
├── calendar-logic.js  # Takvim tarih hesapları (ay ızgarası, hafta aralığı) — DOM'suz
├── doc-intake-logic.js # Yönerge dosyası ayrıştırma mantığı — DOM'suz
├── doc-intake.js      # Yönerge dosyası yükleme arayüzü
├── dehb-info.js       # DEHB Bilgilendirme Platformu içeriği
├── rapor.html         # Rapor sayfası taslağı (şu an uygulamadan linklenmiyor)
├── schema.sql         # Supabase veritabanı şeması
├── fix-tasks-*.sql    # tasks tablosu şema/RLS düzeltmeleri
├── fix-profiles-schema-align.sql # profiles tablosunu şemaya hizalar
├── add-google-refresh-token.sql  # profiles.google_refresh_token kolonu
├── n8n-workflow-focusaid.json # görev parçalama akışı  (webhook: focusaid-processor)
├── n8n-workflow-analyzer.json # yönerge dosyası analizi (webhook: focusaid-analyze)
├── n8n-workflow-report.json   # haftalık rapor akışı    (Pazartesi 07:00, Gmail)
├── infra/n8n/         # n8n sunucusunun kurulum kiti (Oracle + Docker + Caddy + KURULUM.md)
├── render.yaml        # Render servis tanımı
├── Procfile           # Render başlatma komutu
├── requirements.txt   # Python bağımlılıkları
├── test/              # tasks-logic + doc-intake-logic + calendar-logic testleri (node --test)
├── config.example.js  # Konfigürasyon şablonu (bunu kopyala → config.js)
└── config.js          # Gerçek konfigürasyon (gitignored, paylaşma)
```

## Bilinen Eksikler

- **Google Takvim bağlı değilse görevler sessizce takvime yazılmıyor.** Görev Supabase'e her zaman
  kaydediliyor, ama n8n'deki takvim node'ları `onError: continue` ile geçtiği için akış durmuyor ve
  kullanıcı takvimin senkron olmadığını fark etmeyebiliyor (`calendar_event_id` boş kalır).
- Google takvim bağlantısı girişte kuruluyor ve süresi dolunca sunucu üzerinden **sessizce
  yenileniyor** (`serve.py` → `/api/google/refresh`; yenileme `GOOGLE_CLIENT_SECRET` gerektirdiği
  için tarayıcıda yapılamıyor). Yenileme anahtarı kullanıcının kendi `profiles` satırında duruyor,
  RLS ile yalnızca sahibine açık. Kullanıcı Google hesabından izni geri alırsa yenileme
  `invalid_grant` ile başarısız olur; anahtar temizlenir ve "Google Takvimi Bağla" butonu yedek yol
  olarak devreye girer. Görev **kaydetmek** için bağlantı hiç gerekmiyor.
- `rapor.html` hiçbir yerden linklenmiyor — haftalık rapor maili n8n tarafında ayrı bir HTML
  şablonuyla üretiliyor. Dosya ya arayüze bağlanmalı ya da kaldırılmalı.
- Render'ın ücretsiz planı hareketsizlikte servisi uyutuyor; ilk istek 50 saniyeye kadar
  gecikebiliyor.
