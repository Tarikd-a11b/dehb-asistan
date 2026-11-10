# FocusAid — Geliştirici Notları

> Ana tanıtım [README](../README.md)'de. Bu dosya eski README'nin teknik ayrıntılarını (mimari, güvenlik, yerel geliştirme, deploy, dosya yapısı, bilinen eksikler) olduğu gibi saklar.

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

AI Agent yalnızca görev listesini ve her görevin bilişsel yükünü (`low`/`medium`/`high`) üretir;
**tarih/saat yerleştirmesi tamamen Code node'daki algoritmadadır, LLM'e bırakılmaz.** Yerleştirici
görevleri günlere orantılı dağıtır, gün içinde zor görevi erken saate alır, bugünün tavanını
kullanıcının moduna göre ayarlar ve mevcut Google Calendar etkinliklerinin üstüne yazmaz. Plan
çalışma saatlerine sığmıyorsa görev **silinmez**; taşan kısım teslim tarihinden sonraya düşer ve
kullanıcıya kaç görevin taştığı söylenir.

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

**Google Takvim bağlantısı kendiliğinden kuruluyor** — kullanıcı ayrıca bir düğmeye basmak zorunda
değil. Giriş sırasında `calendar.events` izni `access_type=offline` ile isteniyor; Supabase
oturumundaki `provider_token` doğrudan Google API token'ı oluyor, `provider_refresh_token` ise
kullanıcının kendi `profiles` satırına yazılıyor (RLS ile yalnızca sahibine açık). Access token'ın
ömrü dolunca `serve.py` → `/api/google/refresh` ucu onu **sessizce yeniliyor**; yenileme client
secret gerektirdiği için tarayıcıda yapılamaz, secret yalnızca sunucuda (`GOOGLE_CLIENT_SECRET`).
Kullanıcı izni Google hesabından geri alırsa yenileme `invalid_grant` ile düşer, anahtar temizlenir
ve "Google Takvimi Bağla" düğmesi yedek yol olarak devreye girer. Görev **kaydetmek** için takvim
bağlantısı hiç gerekmiyor; bağlantı yalnızca görevlerin Google Calendar'a da işlenmesi,
tamamlandı/erteleme değişikliklerinin oraya yansıması ve FocusAid dışı etkinliklerin takvimde
görünmesi için gerekli.

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

> Uygulamayı **kullanmak** için buraya hiç ihtiyacın yok — [canlı demo](../README.md) yeterli.
> Bu bölüm yalnızca projeyi fork'layıp üzerinde geliştirme yapacaklar için.

```bash
cp config.example.js config.js   # kendi Supabase/Google değerlerini gir
python serve.py                   # http://localhost:3000
```

Tarayıcıda `http://localhost:3000` tanıtım sayfasını, `http://localhost:3000/auth.html` giriş ekranını açar.

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

**Deploy otomatik: `main`'e push → Render deploy eder.** 2026-08-27'de Render GitHub App'ine
repo erişimi yeniden verilerek onarıldı ve uçtan uca ölçüldü — push'tan ~38 saniye sonra yeni
içerik canlıdaydı. (Öncesinde bağlantı kopuktu ve her deploy elle atılıyordu; o dönemin notları
artık geçersiz.) Bir daha bozulursa belirtisi şudur: Render → `dehb-asistan` → **Events**
sayfasında yeni deploy satırı çıkmaz ya da "Manually triggered by you via Dashboard" der.
Geçici çözüm: **Manual Deploy → Deploy latest commit** (~30 sn); kalıcı çözüm
`github.com/settings/installations` → Render → repository access.

Deploy'u yerel dosyaya değil, **canlının servis ettiği içeriğe** bakarak doğrula:
`curl -s https://dehb-asistan.onrender.com/index.html | grep -c <yeni_fonksiyon_adı>`.
`render.yaml` servisin nasıl ayakta durduğunu ve hangi ortam değişkenlerine ihtiyaç duyduğunu
belgeler, ama canlı servis panelden elle kurulduğu için o dosya deploy'u **sürmez**.

**Kendi n8n'ini kurmak istersen:** tam kurulum kiti `infra/n8n/` altında — `kur.sh`,
`docker-compose.yml`, `Caddyfile`, `oracle-cloud-init.txt` ve adım adım `KURULUM.md`.
Workflow tanımları (`n8n-workflow-*.json`) **ayrı ayrı** import edilmeli; hepsi tek canvas'a
yapıştırılırsa tek bir Publish anahtarına bağlanır ve bir credential eksikliği diğer akışları da
bloke eder.

**Testler:** `node --test` — kök dizinden, **argümansız** (346 test; ayrıca `python -m unittest discover -s test -p "test_*.py"` → 31 test, `npm run test:ui` → Playwright arayüz testleri). `node --test test/`
Windows'ta `MODULE_NOT_FOUND` verir.

Saf mantık dosyaları (`*-logic.js`) DOM'suz ve ağsız tutuluyor, testleri de öyle.
`test/n8n-placement.test.js` ayrıca **n8n node kodunu doğrudan koşturuyor**: node kodu repoda bir
JSON alanında durup canlıya elle kopyalandığı için başka türlü hiçbir şey onu test etmiyordu.

## Dosya Yapısı

```
├── landing.html       # Tanıtım sayfası — kök adres (/) burayı sunar.
│                      #   5 sahneli kaydırma anlatısı + arayüz slider'ı
├── landing-gorsel/    # Sahne fotoğrafları + arayuz/ altında 6 uygulama ekranı
├── auth.html          # Google OAuth giriş sayfası
├── index.html         # Ana uygulama (Bugün + Takvim + Parçalayıcı + Projelerim + Profil + DEHB Bilgisi)
├── index_2.html       # index.html'e yönlendirme köprüsü (Supabase redirect URL'i buraya kayıtlı)
├── serve.py           # Uygulama sunucusu: statik dosyalar + config enjeksiyonu + n8n vekili
│                      #   / adresini landing.html'e yönlendirir
│                      #   + /api/google/refresh
├── tasks-logic.js     # Görev mantığı — DOM'suz, test edilebilir
├── tasks-view.js      # Görev ekranı render + Supabase/GAPI çağrıları
├── calendar-logic.js  # Takvim tarih hesapları (ay ızgarası, hafta aralığı) — DOM'suz
├── profile-logic.js   # Profil alanları, doluluk hesabı, n8n'e giden planlama profili — DOM'suz
├── scheduling-logic.js # Gün ataması, bilişsel yük sıralaması, günlük tavanlar — DOM'suz.
│                      #   Tarayıcıda YÜKLENMEZ; gövdesi n8n Code node'una kopyalanır
├── hyperfocus-logic.js # Hiperfokus sayacı — DOM'suz, saf
├── hyperfocus-view.js  # Hiperfokus şeridi + tarayıcı bildirimi
├── doc-intake-logic.js # Yönerge dosyası ayrıştırma mantığı — DOM'suz
├── doc-intake.js      # Yönerge dosyası yükleme arayüzü
├── dehb-info.js       # DEHB Bilgilendirme Platformu içeriği
├── schema.sql         # Supabase veritabanı şeması
├── fix-tasks-*.sql    # tasks tablosu şema/RLS düzeltmeleri
├── fix-profiles-schema-align.sql # profiles tablosunu şemaya hizalar
├── add-google-refresh-token.sql  # profiles.google_refresh_token kolonu
├── n8n-workflow-focusaid.json # görev parçalama akışı  (webhook: focusaid-processor)
├── n8n-workflow-analyzer.json # yönerge dosyası analizi (webhook: focusaid-analyze)
├── n8n-workflow-report.json   # haftalık rapor akışı    (Pazartesi 07:00, Gmail)
├── n8n-workflow-keepwarm.json # Render'ı uyanık tutan ping (10 dk'da bir, 08:00-01:00)
├── LICENSE                    # MIT
├── infra/n8n/         # n8n sunucusunun kurulum kiti (Oracle + Docker + Caddy + KURULUM.md)
├── render.yaml        # Render servis tanımı
├── Procfile           # Render başlatma komutu
├── requirements.txt   # Python bağımlılıkları
├── docs/superpowers/  # tasarım spec'leri ve planlar (tamamlanmış işin tarihsel kaydı)
├── test/              # saf mantık testleri + n8n node kodunun testi (node --test)
├── config.example.js  # Konfigürasyon şablonu (bunu kopyala → config.js)
└── config.js          # Gerçek konfigürasyon (gitignored, paylaşma)
```

## Bilinen Eksikler

- **Takvim senkronu sessizce atlanabiliyor.** n8n'deki takvim node'ları `onError: continue` ile
  geçiyor — bu bilinçli bir tercih, çünkü takvim yazılamasa bile görevin Supabase'e kaydedilmesi
  isteniyor. Kullanıcı artık yanlış bilgilendirilmiyor: n8n cevabındaki `takvimeYazilan` / `toplam`
  sayaçlarına göre mesaj hepsi / hiçbiri / kısmi durumlarını ayırıyor (`parcalamaSonucMesaji`). Ama
  sessiz atlama davranışının kendisi duruyor; görev `calendar_event_id` boş kalarak kaydedilebiliyor.
- **Sığmayan plan teslim tarihini aşar.** Görev sayısı çalışma penceresine sığmıyorsa taşan
  görevler son seansın sonundan itibaren diziliyor. Bilinçli bir takas: eskiden bu görevler aynı
  saate üst üste yığılıyordu ve takvim sessizce yanlış oluyordu; artık sığmama görünür ve
  kullanıcıya kaç görevin taştığı söyleniyor. Kalıcı çözüm kullanıcıda: teslimi uzatmak, çalışma
  penceresini genişletmek ya da kapsamı küçültmek.
- **Render'ın ücretsiz planı 15 dakika trafik almazsa servisi uyutuyor**; uyandırma ~1 dakika
  sürüyor ve o sırada ziyaretçi Render'ın yükleniyor ekranını görüyor. Hafifletmesi
  `n8n-workflow-keepwarm.json`: n8n 10 dakikada bir `/config.js`'i GET'liyor, böylece gündüz
  saatlerinde servis uyumuyor. (Anasayfa değil `/config.js`, çünkü uyandırma etkisi aynı ama
  809 bayt yerine 150 KB indirmek ayda ~477 MB tutuyordu — 5 GB'lik bant genişliği kotasının
  %9.5'i. Bu haliyle ~2.5 MB.) Pencere bilinçli olarak **08:00-01:00** (Europe/Istanbul) —
  Render workspace başına ayda **750 instance saati** veriyor, 7/24 uyanık tutmak ~730 saatle
  bütçenin tamamını yer ve ay sonunda servisi askıya aldırabilir; bu pencere ~520 saat tutuyor.
  Pencereyi genişletmeden önce o hesabı yeniden yap.
  Pencere gece 01:00'de kapandığı için **günün ilk ping'i (08:00) her zaman uyuyan servise
  çarpıyor** ve Render uyanırken 503 döndürdüğünden o çalıştırma hata olarak kaydediliyordu
  (uyandırma yine de tetikleniyor). Bu yüzden `Ping FocusAid` node'unda **Retry On Fail** açık:
  4 deneme, aralarında 20 sn — ilk deneme uyandırır, kalanları soğuk açılışı bekler. Artık
  Executions'ta o akışta kırmızı satır görürsen gerçek bir arıza demektir.
